// Chat et commandes (-help, -login, -start...).

import global from './global.js';
import { saveOption } from './settings.js';

const LIGHT = '#f2fbff';
const DARK = '#181818';

export class ChatClient {
    constructor() {
        this.commands = {};
        this.socket = null;
        this.player = null;
        const input = document.getElementById('chatInput');
        input.addEventListener('keydown', (e) => this.sendChat(e));
        input.addEventListener('keyup', (e) => {
            const key = e.which || e.keyCode;
            if (key === global.KEY_ESC) {
                input.value = '';
                global.canvas?.cv.focus();
            }
        });
        global.chatClient = this;
        this.registerFunctions();
    }

    registerFunctions() {
        const admin = (cmd) => (args) => this.socket?.emit('admin', { cmd, args });
        this.registerCommand('ping', 'Mesurer la latence.', () => this.checkLatency());
        this.registerCommand('dark', 'Basculer le mode sombre.', () => this.toggleDarkMode());
        this.registerCommand('border', 'Afficher ou masquer la bordure.', () => this.toggleBorder());
        this.registerCommand('mass', 'Afficher ou masquer la masse.', () => this.toggleMass());
        this.registerCommand('continuity', 'Continuer à avancer souris hors écran.', () => this.toggleContinuity());
        this.registerCommand('roundfood', 'Nourriture ronde ou polygonale.', (args) => this.toggleRoundFood(args));
        this.registerCommand('help', 'Liste des commandes.', () => this.printHelp());
        this.registerCommand('login', 'Se connecter en admin : -login motdepasse', (args) => this.socket?.emit('pass', args));
        this.registerCommand('kick', '[admin] Exclure un joueur : -kick pseudo [raison]', admin('kick'));
        this.registerCommand('start', '[admin] Lancer une partie : -start [minutes] [secondes entre snapshots]', admin('start'));
        this.registerCommand('stop', '[admin] Terminer la partie maintenant.', admin('stop'));
        this.registerCommand('pause', '[admin] Mettre la partie en pause.', admin('pause'));
        this.registerCommand('resume', '[admin] Reprendre la partie.', admin('resume'));
        this.registerCommand('snapshot', '[admin] Prendre un snapshot tout de suite.', admin('snapshot'));
    }

    addChatLine(name, message, me) {
        if (global.mobile) return;
        const newline = document.createElement('li');
        newline.className = me ? 'me' : 'friend';
        const b = document.createElement('b');
        b.textContent = name.length < 1 ? 'Cellule anonyme' : name;
        newline.appendChild(b);
        newline.appendChild(document.createTextNode(': ' + message));
        this.appendMessage(newline);
    }

    addSystemLine(message) {
        if (global.mobile) return;
        const newline = document.createElement('li');
        newline.className = 'system';
        newline.innerHTML = message; // messages construits par le client ou le serveur (sans HTML utilisateur)
        this.appendMessage(newline);
    }

    appendMessage(node) {
        const chatList = document.getElementById('chatList');
        while (chatList.childNodes.length > 10) chatList.removeChild(chatList.childNodes[0]);
        chatList.appendChild(node);
    }

    sendChat(event) {
        const key = event.which || event.keyCode;
        const input = document.getElementById('chatInput');
        if (key !== global.KEY_ENTER) return;
        event.preventDefault();
        const text = input.value.replace(/(<([^>]+)>)/ig, '').trim();
        if (text !== '') {
            if (text.indexOf('-') === 0) {
                const args = text.substring(1).split(' ').filter(Boolean);
                const cmd = this.commands[args[0]];
                if (cmd) cmd.callback(args.slice(1));
                else this.addSystemLine('Commande inconnue : ' + text + ' (tapez -help).');
            } else if (this.socket) {
                this.socket.emit('playerChat', { message: text });
                this.addChatLine(this.player?.name ?? global.playerName, text, true);
            }
        }
        input.value = '';
        global.canvas?.cv.focus();
    }

    registerCommand(name, description, callback) {
        this.commands[name] = { description, callback };
    }

    printHelp() {
        for (const [cmd, c] of Object.entries(this.commands)) this.addSystemLine('-' + cmd + ' : ' + c.description);
    }

    checkLatency() {
        global.startPingTime = Date.now();
        this.socket?.emit('pingcheck');
    }

    toggleDarkMode(silent) {
        if (global.backgroundColor === LIGHT) {
            global.backgroundColor = DARK;
            global.lineColor = '#ffffff';
            if (!silent) this.addSystemLine('Mode sombre activé.');
            saveOption('darkMode', true);
        } else {
            global.backgroundColor = LIGHT;
            global.lineColor = '#000000';
            if (!silent) this.addSystemLine('Mode sombre désactivé.');
            saveOption('darkMode', false);
        }
    }

    toggleBorder() {
        global.borderDraw = !global.borderDraw;
        this.addSystemLine(global.borderDraw ? 'Bordure affichée.' : 'Bordure masquée.');
        saveOption('border', global.borderDraw);
    }

    toggleMass() {
        global.toggleMassState = global.toggleMassState === 0 ? 1 : 0;
        this.addSystemLine(global.toggleMassState ? 'Masse affichée.' : 'Masse masquée.');
        saveOption('showMass', !!global.toggleMassState);
    }

    toggleContinuity() {
        global.continuity = !global.continuity;
        this.addSystemLine(global.continuity ? 'Continuité activée.' : 'Continuité désactivée.');
        saveOption('continuity', global.continuity);
    }

    toggleRoundFood(args) {
        if ((args && args.length) || global.foodSides < 10) {
            global.foodSides = (args && args[0] && !Number.isNaN(+args[0]) && +args[0] >= 3) ? +args[0] : 10;
            this.addSystemLine('Nourriture ronde.');
        } else {
            global.foodSides = 5;
            this.addSystemLine('Nourriture polygonale.');
        }
        saveOption('roundFood', global.foodSides >= 10);
    }
}
