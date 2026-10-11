// Agar-ancienne — client. Dérivé de owenashurst/agar.io-clone (MIT).

import global from './global.js';
import * as render from './render.js';
import { ChatClient } from './chat-client.js';
import { Canvas } from './canvas.js';
import { GamepadInput } from './gamepad.js';
import { loadKeys, saveKeys, DEFAULT_KEYS, keyLabel, loadOptions, saveOption, loadName, saveName, sessionToken } from './settings.js';

const $ = (id) => document.getElementById(id);

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) global.mobile = true;

let socket = null;
let socketType = null;
let keys = loadKeys();
let player = { id: -1, x: 0, y: 0, cells: [], massTotal: 0, name: '' };
let foods = [];
let viruses = [];
let fireFood = [];
let users = [];
let lastBeepSecond = -1;
let audioCtx = null;
let menuFocus = 0;
const menuButtons = () => [$('startButton'), $('spectateButton'), $('settingsButton')];

const playerConfig = { border: 6, textColor: '#FFFFFF', textBorder: '#000000', textBorderSize: 3, defaultSize: 30 };

// ----- Actions de jeu -----

function doAction(action) {
    if (!socket || !global.gameStart) return;
    switch (action) {
        case 'split':
            $('split_cell').play().catch(() => {});
            socket.emit('2');
            break;
        case 'feed':
            socket.emit('1');
            break;
        case 'recall':
            socket.emit('3');
            break;
        case 'board':
            toggleBoard();
            break;
        default:
    }
}

function toggleBoard(force) {
    global.boardOpen = force ?? !global.boardOpen;
    $('board-panel').classList.toggle('hidden', !global.boardOpen);
    if (global.boardOpen) renderBoard();
}

window.canvas = new Canvas({ keys, onAction: doAction });
window.chat = new ChatClient();
const c = window.canvas.cv;
const graph = c.getContext('2d');

const gamepad = new GamepadInput({
    onTarget: (fx, fy) => {
        global.gamepadActive = true;
        window.canvas.setGamepadTarget(fx, fy);
    },
    onRelease: () => {
        global.gamepadActive = false;
        window.canvas.target = { x: 0, y: 0 };
        global.target = window.canvas.target;
    },
    onAction: (action, menu) => {
        if (menu) return menuAction(action);
        doAction(action);
    },
    onConnected: (pad) => {
        const hint = $('gamepad-hint');
        hint.textContent = '🎮 Manette détectée : ' + (pad.id || '').slice(0, 40);
        hint.classList.add('on');
        window.chat.addSystemLine('Manette détectée.');
    },
});

// ----- Menu -----

function setMenuFocus(i) {
    const buttons = menuButtons();
    menuFocus = (i + buttons.length) % buttons.length;
    buttons.forEach((b, j) => b.classList.toggle('focus', j === menuFocus));
}

function menuAction(action) {
    const visible = $('startMenuWrapper').style.maxHeight !== '0px';
    if (!visible) return;
    if (action === 'up' || action === 'left') setMenuFocus(menuFocus - 1);
    else if (action === 'down' || action === 'right') setMenuFocus(menuFocus + 1);
    else if (action === 'confirm' || action === 'split') menuButtons()[menuFocus].click();
    else if (action === 'board') $('settingsButton').click();
}

function showMenu(show) {
    $('startMenuWrapper').style.maxHeight = show ? '100vh' : '0px';
    $('gameAreaWrapper').style.opacity = show ? 0 : 1;
    if (show) {
        $('playerNameInput').focus();
        setMenuFocus(0);
    } else {
        c.focus();
    }
}

function validNick() {
    return /^[\p{L}\p{N} ._'-]{2,20}$/u.test($('playerNameInput').value.trim());
}

function showNickError(text) {
    const el = $('nickError');
    el.textContent = text;
    el.style.opacity = 1;
}

function startGame(type) {
    global.playerName = $('playerNameInput').value.trim();
    global.playerType = type;
    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;
    if (type === 'player') saveName(global.playerName);

    if (!socket || socket.disconnected || socketType !== type) {
        socketType = type;
        if (socket) socket.close();
        socket = io({ query: { type } });
        setupSocket(socket);
        window.chat.socket = socket;
        window.canvas.socket = socket;
        global.socket = socket;
    }
    if (!global.animLoopHandle) animloop();
    if (type === 'player') {
        socket.emit('join', { name: global.playerName, screenWidth: global.screen.width, screenHeight: global.screen.height, token: sessionToken() });
    } else {
        enterGame();
    }
}

function enterGame() {
    global.gameStart = true;
    global.kicked = false;
    $('end-overlay').classList.add('hidden');
    showMenu(false);
    resize();
}

window.addEventListener('load', () => {
    $('playerNameInput').value = loadName();
    $('spectateButton').onclick = () => startGame('spectator');
    $('startButton').onclick = () => {
        if (validNick()) {
            $('nickError').style.opacity = 0;
            $('spawn_cell').play().catch(() => {});
            startGame('player');
        } else {
            showNickError('Pseudo : 2 à 20 caractères, lettres, chiffres, espace, . _ - \'');
        }
    };
    $('settingsButton').onclick = () => $('settings').classList.toggle('open');
    $('playerNameInput').addEventListener('keydown', (e) => {
        if ((e.which || e.keyCode) === global.KEY_ENTER) $('startButton').click();
    });

    // Options d'affichage.
    const options = loadOptions();
    const bindToggle = (id, option, apply) => {
        const el = $(id);
        if (options[option] !== undefined) { el.checked = options[option]; apply(options[option], true); }
        el.onchange = () => { apply(el.checked, false); saveOption(option, el.checked); };
    };
    bindToggle('visBord', 'border', (v) => { global.borderDraw = v; });
    bindToggle('showMass', 'showMass', (v) => { global.toggleMassState = v ? 1 : 0; });
    bindToggle('continuity', 'continuity', (v) => { global.continuity = v; });
    bindToggle('roundFood', 'roundFood', (v) => { global.foodSides = v ? 10 : 5; });
    bindToggle('darkMode', 'darkMode', (v) => {
        const isDark = global.backgroundColor !== '#f2fbff';
        if (v !== isDark) window.chat.toggleDarkMode(true);
    });

    // Touches configurables.
    const refreshKeyButtons = () => {
        document.querySelectorAll('.keybtn').forEach((b) => { b.textContent = keyLabel(keys[b.dataset.action]); });
        $('recall-key').textContent = keyLabel(keys.recall);
    };
    refreshKeyButtons();
    document.querySelectorAll('.keybtn').forEach((btn) => {
        btn.onclick = () => {
            document.querySelectorAll('.keybtn').forEach((b) => b.classList.remove('listening'));
            btn.classList.add('listening');
            btn.textContent = 'Appuyez…';
            const listener = (e) => {
                e.preventDefault();
                if (e.code !== 'Escape') {
                    for (const a of Object.keys(keys)) if (keys[a] === e.code && a !== btn.dataset.action) keys[a] = null;
                    keys[btn.dataset.action] = e.code;
                    saveKeys(keys);
                    window.canvas.keys = keys;
                }
                btn.classList.remove('listening');
                refreshKeyButtons();
                window.removeEventListener('keydown', listener, true);
            };
            window.addEventListener('keydown', listener, true);
        };
    });
    $('keys-reset').onclick = () => { keys = { ...DEFAULT_KEYS }; saveKeys(keys); window.canvas.keys = keys; refreshKeyButtons(); };

    // Boutons tactiles.
    $('split').onclick = () => doAction('split');
    $('feed').onclick = () => doAction('feed');
    $('recall-btn').onclick = () => doAction('recall');
    $('end-close').onclick = () => $('end-overlay').classList.add('hidden');

    setMenuFocus(0);
    menuPoll();
});

function menuPoll() {
    const menuVisible = !global.gameStart;
    if (menuVisible) gamepad.poll(true);
    requestAnimationFrame(menuPoll);
}

// ----- Socket -----

function handleDisconnect() {
    if (global.kicked) return;
    global.gameStart = false;
    render.drawErrorMessage('Déconnecté', graph, global.screen, 'Reconnexion automatique…');
}

function setupSocket(sock) {
    sock.on('pongcheck', () => {
        const latency = Date.now() - global.startPingTime;
        window.chat.addSystemLine('Ping : ' + latency + ' ms');
    });

    sock.on('connect_error', handleDisconnect);
    sock.on('disconnect', handleDisconnect);
    sock.io.on('reconnect', () => {
        if (global.playerType === 'player' && global.playerName) {
            sock.emit('join', { name: global.playerName, screenWidth: global.screen.width, screenHeight: global.screen.height, token: sessionToken() });
        }
    });

    sock.on('joinError', (message) => {
        showMenu(true);
        showNickError(message);
    });

    const onWelcome = (data) => {
        player = { ...player, ...data.player, cells: [], massTotal: 0 };
        global.player = player;
        window.chat.player = player;
        global.game.width = data.game.width;
        global.game.height = data.game.height;
        if (data.recall) {
            global.recall.cooldownMs = data.recall.cooldownMs;
            global.recall.durationMs = data.recall.durationMs;
        }
        if (data.clock) applyClock(data.clock);
        enterGame();
        window.chat.addSystemLine('Connecté. Tapez <b>-help</b> pour les commandes.');
        if (global.mobile) $('chatbox')?.remove();
    };
    sock.on('welcome', onWelcome);
    sock.on('gameStarted', (data) => {
        onWelcome(data);
        toast('La partie commence !');
        playBeep(880, 0.3);
    });

    sock.on('playerDied', (data) => {
        const name = data.name || 'Cellule anonyme';
        window.chat.addSystemLine('{JEU} <b>' + escapeHtml(name) + '</b> a été mangé par <b>' + escapeHtml(data.killer || '?') + '</b>');
    });
    sock.on('playerDisconnect', (data) => window.chat.addSystemLine('{JEU} <b>' + escapeHtml(data.name || 'Cellule anonyme') + '</b> est parti.'));
    sock.on('playerJoin', (data) => window.chat.addSystemLine('{JEU} <b>' + escapeHtml(data.name || 'Cellule anonyme') + '</b> a rejoint.'));

    sock.on('leaderboard', (data) => {
        global.leaderboard = data;
        renderTop(data);
        if (global.boardOpen) renderBoard();
    });

    sock.on('clock', applyClock);
    sock.on('snapshotTaken', (data) => toast('Snapshot ' + data.index));
    sock.on('gameEnded', showEnd);

    sock.on('recallResult', (data) => {
        if (data.ok) {
            global.recall.readyAt = data.readyAt;
            global.recall.until = data.until;
        } else if (data.reason === 'cooldown') {
            toast('Rappel pas encore disponible');
        } else if (data.reason === 'une_seule_cellule') {
            toast('Rien à refondre');
        }
    });

    sock.on('serverMSG', (data) => window.chat.addSystemLine(escapeHtml(data)));
    sock.on('serverSendPlayerChat', (data) => window.chat.addChatLine(data.sender, data.message, false));

    sock.on('serverTellPlayerMove', (playerData, userData, foodsList, massList, virusList) => {
        if (global.playerType === 'player') {
            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
    });

    sock.on('RIP', (data) => {
        global.gameStart = false;
        render.drawErrorMessage('Vous avez été mangé', graph, global.screen, data?.killer ? 'par ' + data.killer : '');
        window.setTimeout(() => {
            if (global.gameStart) return; // relancé entre-temps par un gameStarted
            showMenu(true);
        }, 2500);
    });

    sock.on('kick', (reason) => {
        global.gameStart = false;
        global.kicked = true;
        render.drawErrorMessage(reason ? 'Exclu : ' + reason : 'Vous avez été exclu', graph, global.screen);
        sock.close();
    });
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ----- HUD -----

const STATE_LABELS = { lobby: 'Échauffement', running: 'Partie en cours', paused: 'Pause', ended: 'Partie terminée' };

function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function applyClock(clock) {
    global.clock = { ...clock, receivedAt: Date.now() };
    $('clock-state').textContent = STATE_LABELS[clock.state] || clock.state;
    $('clock').classList.toggle('paused', clock.state === 'paused');
    $('clock-snap').textContent = clock.state === 'running' && clock.nextSnapshotMs !== null
        ? 'Snapshot ' + (clock.snapshotCount + 1) + ' dans ' + fmt(clock.nextSnapshotMs) + ' · formule ' + clock.formula
        : (clock.state === 'lobby' ? 'En attente du lancement par un admin' : '');
}

function tickClock() {
    const clock = global.clock;
    const el = $('clock-time');
    if (!clock) { el.textContent = '--:--'; return; }
    let remaining = clock.remainingMs;
    if (clock.state === 'running') remaining -= Date.now() - clock.receivedAt;
    if (clock.state === 'lobby') { el.textContent = fmt(clock.durationMs); el.classList.remove('urgent'); return; }
    if (clock.state === 'ended') { el.textContent = '0:00'; el.classList.remove('urgent'); return; }
    el.textContent = fmt(remaining);
    const urgent = clock.state === 'running' && remaining <= 10_000 && remaining > 0;
    el.classList.toggle('urgent', urgent);
    if (urgent) {
        const second = Math.ceil(remaining / 1000);
        if (second !== lastBeepSecond) {
            lastBeepSecond = second;
            playBeep(second <= 3 ? 1200 : 800, 0.08);
        }
    }
}

function tickRecall() {
    const hud = $('recall-hud');
    const now = Date.now();
    const r = global.recall;
    const me = users.find((u) => u.id === player.id);
    if (me && me.recallReadyAt) r.readyAt = me.recallReadyAt;
    if (r.until > now) {
        hud.className = 'hud active';
        $('recall-fill').style.width = '100%';
    } else if (r.readyAt > now) {
        hud.className = 'hud cooling';
        $('recall-fill').style.width = Math.round(100 * (1 - (r.readyAt - now) / r.cooldownMs)) + '%';
    } else {
        hud.className = 'hud';
        $('recall-fill').style.width = '100%';
    }
}

function renderTop(data) {
    const el = $('status');
    let html = '<span class="title">Classement</span>';
    data.top.forEach((p, i) => {
        const name = escapeHtml(p.name || 'Cellule anonyme');
        html += '<br />' + (p.id === player.id ? '<span class="me">' + (i + 1) + '. ' + name + '</span>' : (i + 1) + '. ' + name);
    });
    html += '<span class="hint">' + data.players + ' joueur' + (data.players > 1 ? 's' : '') + ' · ' + keyLabel(keys.board) + ' : classement complet</span>';
    el.innerHTML = html;
}

function renderBoard() {
    const data = global.leaderboard;
    if (!data) return;
    const tbody = $('board-table').querySelector('tbody');
    tbody.innerHTML = '';
    for (const row of data.all) {
        const tr = document.createElement('tr');
        if (row.id === player.id || (row.name && row.name === player.name)) tr.classList.add('me');
        if (!row.alive) tr.classList.add('dead');
        tr.innerHTML = '<td>' + row.rank + '</td><td>' + escapeHtml(row.name || 'Cellule anonyme') + '</td>'
            + '<td class="num">' + row.mass + '</td><td class="num">' + row.kills + '</td>'
            + '<td class="num">' + (row.score === null ? '—' : row.score) + '</td>';
        tbody.appendChild(tr);
    }
    $('board-meta').textContent = data.state === 'lobby' ? 'Échauffement : score non compté' : data.all.length + ' joueurs · score provisoire';
}

function showEnd(data) {
    const tbody = $('end-table').querySelector('tbody');
    tbody.innerHTML = '';
    for (const r of data.ranking) {
        const tr = document.createElement('tr');
        if (r.name === player.name) tr.classList.add('me');
        tr.innerHTML = '<td>' + r.rank + '</td><td>' + escapeHtml(r.name) + '</td><td class="num"><b>' + r.score + '</b></td>'
            + '<td class="num">' + r.snapshotScore + '</td><td class="num">' + r.finalMass + '</td><td class="num">' + r.kills + '</td>'
            + '<td class="num">' + r.deaths + '</td><td class="num">' + r.maxMass + '</td>';
        tbody.appendChild(tr);
    }
    $('end-meta').textContent = 'Partie ' + data.id + ' · ' + fmt(data.durationMs) + ' · ' + data.snapshotCount + ' snapshots · formule ' + data.settings.formula
        + ' · kill = ' + data.settings.killValue + ' pts';
    $('end-overlay').classList.remove('hidden');
    toggleBoard(false);
    playBeep(440, 0.5);
}

let toastTimer = null;
function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2000);
}

function playBeep(freq, duration) {
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.value = 0.08;
        osc.connect(gain).connect(audioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.stop(audioCtx.currentTime + duration);
    } catch { /* audio indisponible */ }
}

// ----- Boucle de rendu -----

const getPosition = (entity, p, screen) => ({
    x: entity.x - p.x + screen.width / 2,
    y: entity.y - p.y + screen.height / 2,
});

function animloop() {
    global.animLoopHandle = window.requestAnimationFrame(animloop);
    gameLoop();
}

function gameLoop() {
    tickClock();
    if (!global.gameStart) return;
    gamepad.poll(false);
    tickRecall();

    graph.fillStyle = global.backgroundColor;
    graph.fillRect(0, 0, global.screen.width, global.screen.height);

    render.drawGrid(global, player, global.screen, graph);
    for (const food of foods) render.drawFood(getPosition(food, player, global.screen), food, global.foodSides, graph);
    for (const mass of fireFood) render.drawFireFood(getPosition(mass, player, global.screen), mass, playerConfig, graph);
    for (const virus of viruses) render.drawVirus(getPosition(virus, player, global.screen), virus, graph);

    const borders = {
        left: global.screen.width / 2 - player.x,
        right: global.screen.width / 2 + global.game.width - player.x,
        top: global.screen.height / 2 - player.y,
        bottom: global.screen.height / 2 + global.game.height - player.y,
    };
    if (global.borderDraw) render.drawBorder(borders, global.lineColor, graph);

    const cellsToDraw = [];
    for (const user of users) {
        const color = 'hsl(' + user.hue + ', 100%, 50%)';
        const borderColor = 'hsl(' + user.hue + ', 100%, 45%)';
        for (const cell of user.cells) {
            cellsToDraw.push({
                color, borderColor,
                mass: cell.mass,
                name: user.name,
                radius: cell.radius,
                recalling: user.recalling,
                x: cell.x - player.x + global.screen.width / 2,
                y: cell.y - player.y + global.screen.height / 2,
            });
        }
    }
    cellsToDraw.sort((a, b) => a.mass - b.mass);
    render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph, performance.now());

    // Le battement de cœur est envoyé par heartbeat() : un onglet en arrière-plan n'anime plus.
}

window.addEventListener('resize', resize);

function resize() {
    if (!socket) return;
    const isPlayer = global.playerType === 'player';
    player.screenWidth = c.width = global.screen.width = isPlayer ? window.innerWidth : global.game.width;
    player.screenHeight = c.height = global.screen.height = isPlayer ? window.innerHeight : global.game.height;
    if (!isPlayer) {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }
    socket.emit('windowResized', { screenWidth: global.screen.width, screenHeight: global.screen.height });
}

// Cible et signe de vie, indépendants du rendu (un onglet en arrière-plan
// suspend requestAnimationFrame mais pas setInterval).
function heartbeat() {
    if (socket && global.gameStart && global.playerType === 'player') socket.emit('0', window.canvas.target);
}
setInterval(heartbeat, 50);
