// Manette (Gamepad API). Le mapping « standard » du navigateur est le même
// pour Xbox et PlayStation : 0 = A/Croix, 1 = B/Rond, 2 = X/Carré,
// 3 = Y/Triangle, 9 = Start/Options, 12-15 = croix directionnelle.

const DEADZONE = 0.18;
const BUTTONS = { split: [0], feed: [2], recall: [1, 3], board: [9], confirm: [0], up: [12], down: [13], left: [14], right: [15] };

export class GamepadInput {
    constructor({ onTarget, onRelease, onAction, onConnected }) {
        this.onTarget = onTarget;
        this.onRelease = onRelease;
        this.onAction = onAction;
        this.onConnected = onConnected;
        this.pressed = new Map(); // bouton -> état précédent
        this.stickActive = false;
        this.connected = false;
        this.lastRepeat = 0;

        window.addEventListener('gamepadconnected', (e) => {
            this.connected = true;
            onConnected?.(e.gamepad);
        });
        window.addEventListener('gamepaddisconnected', () => {
            this.connected = navigator.getGamepads().some((g) => g);
        });
    }

    first() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const pad of pads) if (pad && pad.connected) return pad;
        return null;
    }

    // À appeler à chaque frame. `menu` = true quand on est sur l'écran d'accueil.
    poll(menu = false) {
        const pad = this.first();
        if (!pad) return;
        if (!this.connected) { this.connected = true; this.onConnected?.(pad); }

        // Stick gauche : intensité proportionnelle, centre = immobile.
        const x = pad.axes[0] ?? 0;
        const y = pad.axes[1] ?? 0;
        const mag = Math.hypot(x, y);
        if (!menu) {
            if (mag > DEADZONE) {
                const scale = (mag - DEADZONE) / (1 - DEADZONE);
                this.stickActive = true;
                this.onTarget(x / mag * scale, y / mag * scale);
            } else if (this.stickActive) {
                this.stickActive = false;
                this.onRelease();
            }
        }

        // Boutons : front montant uniquement, avec répétition lente pour la croix en menu.
        const now = performance.now();
        for (const [action, indexes] of Object.entries(BUTTONS)) {
            for (const i of indexes) {
                const down = !!pad.buttons[i]?.pressed;
                const was = this.pressed.get(i) || false;
                this.pressed.set(i, down);
                const isNav = ['up', 'down', 'left', 'right'].includes(action);
                if (down && !was) {
                    this.lastRepeat = now;
                    this.onAction(action, menu);
                } else if (down && was && isNav && menu && now - this.lastRepeat > 250) {
                    this.lastRepeat = now;
                    this.onAction(action, menu);
                }
            }
        }
        // En menu, la croix peut aussi être sur les axes 0/1 (certaines manettes).
        if (menu && mag > 0.7 && now - this.lastRepeat > 300) {
            this.lastRepeat = now;
            if (Math.abs(y) > Math.abs(x)) this.onAction(y < 0 ? 'up' : 'down', true);
            else this.onAction(x < 0 ? 'left' : 'right', true);
        }
    }
}
