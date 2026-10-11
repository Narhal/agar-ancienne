// N4Agar — serveur de jeu. Dérivé de owenashurst/agar.io-clone (MIT).
//
// Le serveur fait foi sur tout : positions, masses, fusions, temps, score.
// Le client ne fait que rendre et envoyer sa cible et ses actions.

import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import SAT from 'sat';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { networkInterfaces } from 'node:os';

import config from './config.js';
import { Game } from './game.js';
import { GameMap } from './game/map.js';
import { Player } from './game/player.js';
import { mathLog, massToRadius, getIndexes } from './game/util.js';
import { getPosition } from './game/entities.js';
import { validerPseudo, normaliser, MOTIFS } from './pseudo.js';
import { openDatabase } from './db.js';
import { writeGameFiles } from './logs.js';
import { adminRouter, checkPassword } from './admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = join(__dirname, '..', 'client');

const app = express();
const http = createServer(app);
const io = new SocketServer(http, { serveClient: true });
const db = openDatabase(config.dataDir);
const game = new Game(config);
const map = new GameMap(config);

const INIT_MASS_LOG = mathLog(config.defaultPlayerMass, config.slowBase);
const stripTags = (s) => String(s ?? '').replace(/(<([^>]+)>)/ig, '');

const sockets = {};          // socket.id -> socket
const spectators = new Set(); // socket.id
const byName = new Map();     // pseudo normalisé -> Player (connecté ou en délai de grâce)
const reservations = new Map(); // pseudo normalisé -> ip, jusqu'au prochain -start

let lastLeaderboard = null;

// ----- Pages -----

app.disable('x-powered-by');
app.use(express.static(clientDir));
app.get('/classement', (req, res) => res.sendFile(join(clientDir, 'classement.html')));
app.get('/admin', (req, res) => res.sendFile(join(clientDir, 'admin.html')));
app.get('/api/config', (req, res) => res.json({
    gameWidth: config.gameWidth,
    gameHeight: config.gameHeight,
    recallCooldownSec: config.recallCooldownSec,
    recallDurationSec: config.recallDurationSec,
}));

// ----- Helpers -----

function generateSpawnpoint() {
    const radius = massToRadius(config.defaultPlayerMass);
    return getPosition(config.newPlayerInitialPosition === 'farthest', radius, map.players.data, config.gameWidth, config.gameHeight);
}

function alivePlayers() {
    return map.players.data.map((p) => ({ name: p.name, mass: p.massTotal }));
}

function connectedNames() {
    return [...byName.values()].filter((p) => !p.disconnectedAt).map((p) => p.name);
}

function spawnPlayer(player) {
    player.init(generateSpawnpoint(), config.defaultPlayerMass);
    if (map.players.findIndexByID(player.id) === -1) map.players.pushNew(player);
    game.recordSpawn(player.name);
}

function welcomePayload(player) {
    return {
        player: { id: player.id, name: player.name, hue: player.hue, x: player.x, y: player.y },
        game: { width: config.gameWidth, height: config.gameHeight },
        clock: game.clock(),
        recall: { cooldownMs: config.recallCooldownSec * 1000, durationMs: config.recallDurationSec * 1000 },
    };
}

function forgetPlayer(player) {
    map.players.removePlayerByID(player.id);
    if (byName.get(normaliser(player.name)) === player) byName.delete(normaliser(player.name));
    delete sockets[player.id];
}

function broadcastSystem(text) {
    io.emit('serverMSG', text);
}

// ----- Classement complet -----

function buildLeaderboard() {
    const ranked = map.players.getRanked();
    const top = ranked.slice(0, 10).map((p) => ({ id: p.id, name: p.name, mass: Math.round(p.massTotal) }));
    let all;
    if (game.state === 'lobby') {
        all = ranked.map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, mass: Math.round(p.massTotal), kills: p.kills, score: null, alive: true }));
    } else {
        const ranking = game.state === 'ended' && game.lastResult ? game.lastResult.ranking : game.provisionalRanking(alivePlayers());
        const aliveById = new Map(map.players.data.map((p) => [normaliser(p.name), p]));
        all = ranking.map((r) => {
            const p = aliveById.get(normaliser(r.name));
            return { rank: r.rank, id: p?.id ?? null, name: r.name, mass: p ? Math.round(p.massTotal) : 0, kills: r.kills, score: r.score, alive: !!p };
        });
    }
    return { players: map.players.data.length, state: game.state, top, all };
}

function sendLeaderboard() {
    lastLeaderboard = buildLeaderboard();
    io.emit('leaderboard', lastLeaderboard);
    io.emit('clock', game.clock());
}

// ----- Partie -----

function startGame({ minutes, snapshotSec } = {}) {
    const errors = game.updateSettings({ durationMin: minutes, snapshotSec });
    if (errors.length) return { erreur: 'parametres', champs: errors };
    map.resetWorld();
    map.players.data.length = 0;
    reservations.clear();
    const names = connectedNames();
    const id = game.start({}, names);
    for (const player of byName.values()) {
        if (player.disconnectedAt) continue;
        reservations.set(normaliser(player.name), player.ipAddress);
        spawnPlayer(player);
        sockets[player.id]?.emit('gameStarted', welcomePayload(player));
    }
    map.balanceMass();
    sendLeaderboard();
    broadcastSystem(`La partie commence : ${Math.round(game.settings.durationMs / 60000)} min, snapshot toutes les ${Math.round(game.settings.snapshotIntervalMs / 1000)} s.`);
    console.log(`[PARTIE] ${id} démarrée (${names.length} joueurs, ${game.settings.durationMs / 60000} min, formule ${game.settings.formula})`);
    return { ok: true, id, clock: game.clock() };
}

function endGame(reason) {
    const result = game.finish(alivePlayers());
    if (!result) return { erreur: 'pas_de_partie' };
    try {
        const dir = writeGameFiles(result, config.partiesDir);
        console.log(`[PARTIE] ${result.id} terminée (${reason}) : exports dans ${dir}`);
    } catch (err) {
        console.error('[PARTIE] Échec d\'écriture des exports', err);
    }
    try {
        db.saveGame(result);
    } catch (err) {
        console.error('[PARTIE] Échec d\'enregistrement en base', err);
    }
    io.emit('gameEnded', { id: result.id, ranking: result.ranking, durationMs: result.durationMs, settings: result.settings, snapshotCount: result.snapshots.length });
    sendLeaderboard();
    const winner = result.ranking[0];
    broadcastSystem(winner ? `Fin de partie ! Vainqueur : ${winner.name} (${winner.score} pts).` : 'Fin de partie.');
    return { ok: true, id: result.id };
}

const actions = {
    state() {
        return {
            clock: game.clock(),
            settings: { ...game.settings, durationMin: game.settings.durationMs / 60000, snapshotSec: game.settings.snapshotIntervalMs / 1000 },
            players: [...byName.values()].map((p) => ({
                name: p.name, ip: p.ipAddress, alive: map.players.findIndexByID(p.id) > -1,
                mass: Math.round(p.massTotal ?? 0), kills: p.kills, admin: p.admin, disconnected: !!p.disconnectedAt,
            })),
            spectators: spectators.size,
            leaderboard: lastLeaderboard ?? buildLeaderboard(),
            lastResult: game.lastResult ? { id: game.lastResult.id, endedAt: game.lastResult.endedAt, winner: game.lastResult.ranking[0]?.name ?? null } : null,
        };
    },
    start(opts) {
        if (game.state === 'running' || game.state === 'paused') return { erreur: 'partie_en_cours' };
        return startGame(opts);
    },
    stop() {
        if (game.state !== 'running' && game.state !== 'paused') return { erreur: 'pas_de_partie' };
        return endGame('arrêt admin');
    },
    pause() {
        if (!game.pause()) return { erreur: 'pas_en_cours' };
        broadcastSystem('Partie en pause.');
        sendLeaderboard();
        return { ok: true };
    },
    resume() {
        if (!game.resume()) return { erreur: 'pas_en_pause' };
        broadcastSystem('Reprise de la partie.');
        sendLeaderboard();
        return { ok: true };
    },
    snapshot() {
        if (game.state !== 'running') return { erreur: 'pas_en_cours' };
        const s = game.takeSnapshot(alivePlayers());
        broadcastSystem(`Snapshot ${s.index} pris.`);
        sendLeaderboard();
        return { ok: true, snapshot: s.index };
    },
    settings(patch) {
        const errors = game.updateSettings(patch);
        if (errors.length) return { erreur: 'parametres', champs: errors };
        sendLeaderboard();
        return { ok: true, settings: game.settings };
    },
    kick(name, reason) {
        const player = byName.get(normaliser(name));
        if (!player || player.admin) return { erreur: 'introuvable' };
        const socket = sockets[player.id];
        socket?.emit('kick', reason);
        socket?.disconnect();
        forgetPlayer(player);
        game.recordDisconnect(player.name);
        console.log(`[ADMIN] ${player.name} exclu${reason ? ' : ' + reason : ''}`);
        return { ok: true };
    },
    message(text) {
        if (!text) return { erreur: 'vide' };
        broadcastSystem(`[ADMIN] ${text}`);
        return { ok: true };
    },
};

app.use(adminRouter({ adminPass: config.adminPass, db, actions }));

// ----- Sockets -----

io.on('connection', (socket) => {
    const type = socket.handshake.query.type;
    switch (type) {
        case 'player': addPlayer(socket); break;
        case 'spectator': addSpectator(socket); break;
        case 'board': addBoard(socket); break;
        default: socket.disconnect();
    }
});

function addBoard(socket) {
    socket.emit('leaderboard', lastLeaderboard ?? buildLeaderboard());
    socket.emit('clock', game.clock());
    if (game.state === 'ended' && game.lastResult) {
        const r = game.lastResult;
        socket.emit('gameEnded', { id: r.id, ranking: r.ranking, durationMs: r.durationMs, settings: r.settings, snapshotCount: r.snapshots.length });
    }
}

function addSpectator(socket) {
    sockets[socket.id] = socket;
    spectators.add(socket.id);
    socket.emit('welcome', { player: {}, game: { width: config.gameWidth, height: config.gameHeight }, clock: game.clock() });
    addBoard(socket);
    socket.on('disconnect', () => {
        spectators.delete(socket.id);
        delete sockets[socket.id];
    });
}

function addPlayer(socket) {
    let currentPlayer = new Player(socket.id);
    currentPlayer.ipAddress = socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() || socket.handshake.address;
    const ip = currentPlayer.ipAddress;

    socket.on('join', (data = {}) => {
        const check = validerPseudo(data.name);
        if (!check.ok) return socket.emit('joinError', MOTIFS[check.motif]);
        const key = check.normalise;
        const existing = byName.get(key);

        if (existing && existing !== currentPlayer) {
            const sameOwner = existing.ipAddress === ip || (existing.token && existing.token === data.token);
            if (existing.disconnectedAt && sameOwner) {
                // Reconnexion pendant le délai de grâce : on reprend la cellule.
                delete sockets[existing.id];
                existing.id = socket.id;
                existing.disconnectedAt = null;
                existing.screenWidth = data.screenWidth;
                existing.screenHeight = data.screenHeight;
                existing.setLastHeartbeat();
                currentPlayer = existing;
                sockets[socket.id] = socket;
                socket.emit('welcome', welcomePayload(currentPlayer));
                socket.emit('serverMSG', 'Reconnecté : vous avez récupéré votre cellule.');
                console.log(`[INFO] ${existing.name} reconnecté (${ip})`);
                return;
            }
            return socket.emit('joinError', MOTIFS.deja_pris);
        }
        const reservedIp = reservations.get(key);
        if (reservedIp && reservedIp !== ip) return socket.emit('joinError', MOTIFS.deja_pris);

        const firstJoin = !existing;
        if (firstJoin) {
            currentPlayer.name = check.pseudo;
            currentPlayer.token = typeof data.token === 'string' ? data.token.slice(0, 64) : null;
            byName.set(key, currentPlayer);
            sockets[socket.id] = socket;
            if (game.isCounting) reservations.set(key, ip);
            game.recordConnect(currentPlayer.name);
            io.emit('playerJoin', { name: currentPlayer.name });
            console.log(`[INFO] ${currentPlayer.name} a rejoint (${ip}) — ${byName.size} joueurs`);
        } else if (normaliser(currentPlayer.name) !== key) {
            // Même socket, nouveau pseudo : on libère l'ancien.
            byName.delete(normaliser(currentPlayer.name));
            currentPlayer.name = check.pseudo;
            byName.set(key, currentPlayer);
        }
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
        currentPlayer.setLastHeartbeat();
        spawnPlayer(currentPlayer);
        socket.emit('welcome', welcomePayload(currentPlayer));
    });

    socket.on('pingcheck', () => socket.emit('pongcheck'));

    socket.on('windowResized', (data = {}) => {
        currentPlayer.screenWidth = Number(data.screenWidth) || currentPlayer.screenWidth;
        currentPlayer.screenHeight = Number(data.screenHeight) || currentPlayer.screenHeight;
    });

    socket.on('disconnect', () => {
        if (sockets[currentPlayer.id] !== socket) return; // repris par une reconnexion
        const inWorld = map.players.findIndexByID(currentPlayer.id) > -1;
        if (inWorld && (game.state === 'running' || game.state === 'paused')) {
            currentPlayer.disconnectedAt = Date.now();
            console.log(`[INFO] ${currentPlayer.name} déconnecté, délai de grâce de ${config.reconnectGraceSec} s`);
            return;
        }
        forgetPlayer(currentPlayer);
        if (currentPlayer.name) {
            game.recordDisconnect(currentPlayer.name);
            socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
            console.log(`[INFO] ${currentPlayer.name} déconnecté`);
        }
    });

    socket.on('playerChat', (data = {}) => {
        if (!currentPlayer.name) return;
        const message = stripTags(data.message).substring(0, 80);
        if (!message) return;
        if (config.logChat === 1) console.log(`[CHAT] ${currentPlayer.name}: ${message}`);
        socket.broadcast.emit('serverSendPlayerChat', { sender: currentPlayer.name, message });
        try { db.logChat(game.id, currentPlayer.name, message, ip); } catch (err) { console.error(err); }
    });

    socket.on('pass', (data) => {
        const password = Array.isArray(data) ? data[0] : data;
        if (checkPassword(password, config.adminPass)) {
            currentPlayer.admin = true;
            socket.emit('serverMSG', `Bienvenue ${currentPlayer.name}, vous êtes admin. Commandes : -start [min] [snapSec], -stop, -pause, -resume, -snapshot, -kick pseudo.`);
            socket.broadcast.emit('serverMSG', `${currentPlayer.name} est maintenant admin.`);
            console.log(`[ADMIN] ${currentPlayer.name} connecté en admin`);
        } else {
            socket.emit('serverMSG', 'Mot de passe incorrect, tentative journalisée.');
            console.log(`[ADMIN] ${currentPlayer.name} : mot de passe admin incorrect`);
            try { db.logFailedLogin(currentPlayer.name, ip, 'chat'); } catch (err) { console.error(err); }
        }
    });

    socket.on('admin', (data = {}) => {
        if (!currentPlayer.admin) return socket.emit('serverMSG', 'Commande réservée aux admins (-login mot_de_passe).');
        const args = Array.isArray(data.args) ? data.args : [];
        let r;
        switch (data.cmd) {
            case 'start': r = actions.start({ minutes: args[0], snapshotSec: args[1] }); break;
            case 'stop': r = actions.stop(); break;
            case 'pause': r = actions.pause(); break;
            case 'resume': r = actions.resume(); break;
            case 'snapshot': r = actions.snapshot(); break;
            case 'kick': r = actions.kick(args[0] ?? '', args.slice(1).join(' ')); break;
            default: r = { erreur: 'commande_inconnue' };
        }
        if (r.erreur) socket.emit('serverMSG', `Refusé : ${r.erreur}${r.champs ? ' (' + r.champs.join(', ') + ')' : ''}`);
        else socket.emit('serverMSG', `OK ${data.cmd}`);
    });

    // Cible du joueur (« heartbeat »).
    socket.on('0', (target) => {
        currentPlayer.setLastHeartbeat();
        if (game.isFrozen || !target) return;
        const x = Number(target.x);
        const y = Number(target.y);
        if (Number.isFinite(x) && Number.isFinite(y)) currentPlayer.target = { x, y };
    });

    // Projeter de la masse.
    socket.on('1', () => {
        if (game.isFrozen || !currentPlayer.cells) return;
        const minCellMass = config.defaultPlayerMass + config.fireFood;
        for (let i = 0; i < currentPlayer.cells.length; i++) {
            if (currentPlayer.cells[i].mass >= minCellMass) {
                currentPlayer.changeCellMass(i, -config.fireFood);
                map.massFood.addNew(currentPlayer, i, config.fireFood);
            }
        }
    });

    // Split.
    socket.on('2', () => {
        if (game.isFrozen || !currentPlayer.cells) return;
        currentPlayer.userSplit(config.limitSplit, config.defaultPlayerMass);
    });

    // Rappel (se refondre).
    socket.on('3', () => {
        if (game.isFrozen || !currentPlayer.cells) return;
        const refus = currentPlayer.recall(config.recallCooldownSec * 1000, config.recallDurationSec * 1000);
        socket.emit('recallResult', { ok: !refus, reason: refus, readyAt: currentPlayer.recallReadyAt, until: currentPlayer.recallUntil });
    });
}

// ----- Boucle de jeu -----

function tickPlayer(currentPlayer) {
    if (!currentPlayer.disconnectedAt && currentPlayer.lastHeartbeat < Date.now() - config.maxHeartbeatInterval) {
        const socket = sockets[currentPlayer.id];
        socket?.emit('kick', 'Aucun signe de vie depuis ' + config.maxHeartbeatInterval + ' ms.');
        socket?.disconnect();
        return;
    }

    currentPlayer.move(config.slowBase, config.gameWidth, config.gameHeight, INIT_MASS_LOG);

    const isInside = (point, circle) => SAT.pointInCircle(new SAT.Vector(point.x, point.y), circle);

    const canEatMass = (cell, cellCircle, cellIndex, mass) => {
        if (!isInside(mass, cellCircle)) return false;
        if (mass.id === currentPlayer.id && mass.speed > 0 && cellIndex === mass.num) return false;
        return cell.mass > mass.mass * 1.1;
    };

    const cellsToSplit = [];
    for (let cellIndex = 0; cellIndex < currentPlayer.cells.length; cellIndex++) {
        const currentCell = currentPlayer.cells[cellIndex];
        const cellCircle = currentCell.toCircle();

        const eatenFoodIndexes = getIndexes(map.food.data, (food) => isInside(food, cellCircle));
        const eatenMassIndexes = getIndexes(map.massFood.data, (mass) => canEatMass(currentCell, cellCircle, cellIndex, mass));
        const eatenVirusIndexes = getIndexes(map.viruses.data, (virus) => virus.mass < currentCell.mass && isInside(virus, cellCircle));

        if (eatenVirusIndexes.length > 0) {
            cellsToSplit.push(cellIndex);
            map.viruses.delete(eatenVirusIndexes);
        }

        let massGained = eatenMassIndexes.reduce((acc, index) => acc + map.massFood.data[index].mass, 0);
        map.food.delete(eatenFoodIndexes);
        map.massFood.remove(eatenMassIndexes);
        massGained += eatenFoodIndexes.length * config.foodMass;
        currentPlayer.changeCellMass(cellIndex, massGained);
    }
    currentPlayer.virusSplit(cellsToSplit, config.limitSplit, config.defaultPlayerMass);
}

function tickGame() {
    if (game.isFrozen) return;
    map.players.data.forEach(tickPlayer);
    map.massFood.move(config.gameWidth, config.gameHeight);

    const deadIndexes = [];
    map.players.handleCollisions((gotEaten, eater) => {
        const eaterPlayer = map.players.data[eater.playerIndex];
        const eatenPlayer = map.players.data[gotEaten.playerIndex];
        const cellGotEaten = map.players.getCell(gotEaten.playerIndex, gotEaten.cellIndex);
        if (!cellGotEaten || !eaterPlayer || !eatenPlayer) return;

        eaterPlayer.changeCellMass(eater.cellIndex, cellGotEaten.mass);
        const playerDied = map.players.removeCell(gotEaten.playerIndex, gotEaten.cellIndex);
        if (playerDied && !deadIndexes.includes(gotEaten.playerIndex)) {
            deadIndexes.push(gotEaten.playerIndex);
            eaterPlayer.kills += 1;
            game.recordKill(eaterPlayer.name, eatenPlayer.name, eaterPlayer.massTotal);
            game.recordDeath(eatenPlayer.name);
            io.emit('playerDied', { name: eatenPlayer.name, killer: eaterPlayer.name });
            sockets[eatenPlayer.id]?.emit('RIP', { killer: eaterPlayer.name });
            console.log(`[JEU] ${eaterPlayer.name} a mangé ${eatenPlayer.name}`);
        }
    });
    // Retrait des morts, de la fin vers le début pour ne pas décaler les index.
    deadIndexes.sort((a, b) => b - a);
    for (const index of deadIndexes) {
        const dead = map.players.data[index];
        map.players.removePlayerByIndex(index);
        if (dead?.disconnectedAt) forgetPlayer(dead);
    }
}

function gameloop() {
    const now = Date.now();
    // Délais de grâce expirés.
    for (const player of [...byName.values()]) {
        if (player.disconnectedAt && now - player.disconnectedAt > config.reconnectGraceSec * 1000) {
            forgetPlayer(player);
            game.recordDisconnect(player.name);
            io.emit('playerDisconnect', { name: player.name });
            console.log(`[INFO] ${player.name} : délai de grâce expiré`);
        }
    }

    if (map.players.data.length > 0 && !game.isFrozen) {
        map.players.shrinkCells(config.massLossRate, config.defaultPlayerMass, config.minMassLoss);
    }
    if (!game.isFrozen) map.balanceMass();

    const out = game.tick(alivePlayers());
    if (out.snapshot) {
        io.emit('snapshotTaken', { index: out.snapshot.index, at: out.snapshot.at });
        console.log(`[PARTIE] Snapshot ${out.snapshot.index} (${out.snapshot.entries.length} joueurs)`);
    }
    if (out.ended) {
        endGame('temps écoulé');
        return;
    }
    sendLeaderboard();
}

function sendUpdates() {
    for (const id of spectators) {
        sockets[id]?.emit('serverTellPlayerMove',
            { x: config.gameWidth / 2, y: config.gameHeight / 2, cells: [], massTotal: 0, hue: 100, id, name: '' },
            map.players.data.map(GameMap.projectPlayer), map.food.data, map.massFood.data, map.viruses.data);
    }
    map.enumerateWhatPlayersSee((player, playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses) => {
        sockets[player.id]?.emit('serverTellPlayerMove', playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses);
    });
}

setInterval(tickGame, 1000 / 60);
setInterval(gameloop, 1000);
setInterval(sendUpdates, 1000 / config.networkUpdateFactor);

// ----- Démarrage -----

function lanAddresses() {
    const out = [];
    for (const list of Object.values(networkInterfaces())) {
        for (const i of list ?? []) {
            if (i.family === 'IPv4' && !i.internal) out.push(i.address);
        }
    }
    return out;
}

http.listen(config.port, config.host, () => {
    console.log(`[N4AGAR] Serveur prêt sur le port ${config.port}`);
    for (const addr of lanAddresses()) console.log(`[N4AGAR]   jeu : http://${addr}:${config.port}/   classement : /classement   admin : /admin`);
    if (config.adminPass === 'changez-moi') console.warn('[N4AGAR] ADMIN_PASS est à sa valeur par défaut : changez-le dans .env ou docker-compose.yml');
});

process.on('SIGTERM', () => { db.close(); process.exit(0); });
process.on('SIGINT', () => { db.close(); process.exit(0); });
