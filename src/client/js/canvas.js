// Entrées souris, tactile et clavier sur le canvas.

import global from './global.js';

export class Canvas {
    constructor({ keys, onAction }) {
        this.keys = keys;
        this.onAction = onAction;
        this.directionLock = false;
        this.target = global.target;
        this.reenviar = true;
        this.socket = global.socket;
        this.directions = [];

        this.cv = document.getElementById('cvs');
        this.cv.width = global.screen.width;
        this.cv.height = global.screen.height;
        this.cv.addEventListener('mousemove', (e) => this.gameInput(e), false);
        this.cv.addEventListener('mouseout', () => this.outOfBounds(), false);
        this.cv.addEventListener('keydown', (e) => this.keyDown(e), false);
        this.cv.addEventListener('keyup', (e) => this.keyUp(e), false);
        this.cv.addEventListener('touchstart', (e) => this.touchInput(e), { passive: false });
        this.cv.addEventListener('touchmove', (e) => this.touchInput(e), { passive: false });
        global.canvas = this;
    }

    keyDown(event) {
        const key = event.which || event.keyCode;
        if (this.directional(key)) {
            event.preventDefault();
            this.directionLock = true;
            if (this.newDirection(key, this.directions, true)) {
                this.updateTarget(this.directions);
                this.socket?.emit('0', this.target);
            }
            return;
        }
        const code = event.code;
        const keys = this.keys;
        if (code === keys.board) {
            event.preventDefault();
            if (!event.repeat) this.onAction('board');
        } else if (code === keys.split && this.reenviar) {
            event.preventDefault();
            this.reenviar = false;
            this.onAction('split');
        } else if (code === keys.feed && this.reenviar) {
            event.preventDefault();
            this.reenviar = false;
            this.onAction('feed');
        } else if (code === keys.recall && this.reenviar) {
            event.preventDefault();
            this.reenviar = false;
            this.onAction('recall');
        } else if (key === global.KEY_ENTER) {
            document.getElementById('chatInput')?.focus();
        }
    }

    keyUp(event) {
        this.reenviar = true;
        const key = event.which || event.keyCode;
        if (this.directional(key)) {
            if (this.newDirection(key, this.directions, false)) {
                this.updateTarget(this.directions);
                if (this.directions.length === 0) this.directionLock = false;
                this.socket?.emit('0', this.target);
            }
        }
    }

    newDirection(direction, list, isAddition) {
        let result = false;
        let found = false;
        for (let i = 0; i < list.length; i++) {
            if (list[i] === direction) {
                found = true;
                if (!isAddition) {
                    result = true;
                    list.splice(i, 1);
                }
                break;
            }
        }
        if (isAddition && !found) {
            result = true;
            list.push(direction);
        }
        return result;
    }

    updateTarget(list) {
        this.target = { x: 0, y: 0 };
        let directionHorizontal = 0;
        let directionVertical = 0;
        for (const d of list) {
            if (directionHorizontal === 0) {
                if (d === global.KEY_LEFT) directionHorizontal -= Number.MAX_VALUE;
                else if (d === global.KEY_RIGHT) directionHorizontal += Number.MAX_VALUE;
            }
            if (directionVertical === 0) {
                if (d === global.KEY_UP) directionVertical -= Number.MAX_VALUE;
                else if (d === global.KEY_DOWN) directionVertical += Number.MAX_VALUE;
            }
        }
        this.target.x += directionHorizontal;
        this.target.y += directionVertical;
        global.target = this.target;
    }

    directional(key) {
        return key === global.KEY_LEFT || key === global.KEY_RIGHT || key === global.KEY_DOWN || key === global.KEY_UP;
    }

    outOfBounds() {
        if (!global.continuity && !global.gamepadActive) {
            this.target = { x: 0, y: 0 };
            global.target = this.target;
        }
    }

    gameInput(mouse) {
        if (!this.directionLock && !global.gamepadActive) {
            this.target.x = mouse.clientX - this.cv.width / 2;
            this.target.y = mouse.clientY - this.cv.height / 2;
            global.target = this.target;
        }
    }

    touchInput(touch) {
        touch.preventDefault();
        touch.stopPropagation();
        if (!this.directionLock) {
            this.target.x = touch.touches[0].clientX - this.cv.width / 2;
            this.target.y = touch.touches[0].clientY - this.cv.height / 2;
            global.target = this.target;
        }
    }

    // Cible venant de la manette, en fraction de l'écran (-1..1).
    setGamepadTarget(fx, fy) {
        const half = Math.min(this.cv.width, this.cv.height) / 2;
        this.target.x = fx * half;
        this.target.y = fy * half;
        global.target = this.target;
    }
}
