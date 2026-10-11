// Bots de test : des joueurs qui errent, splittent et se rappellent au hasard.
//
//   node tools/bots.js [nombre=10] [url=http://localhost:3000]
//
// Utile pour vérifier le classement complet, les snapshots et la charge
// avec 70 joueurs sans mobiliser 70 machines.

import { io } from 'socket.io-client';

const count = Number(process.argv[2] ?? 10);
const url = process.argv[3] ?? 'http://localhost:3000';

const PRENOMS = ['Alix', 'Bastien', 'Camille', 'Dorian', 'Elise', 'Farid', 'Gaëlle', 'Hugo', 'Inès', 'Jules', 'Kenza', 'Loïc', 'Maé', 'Nino', 'Océane', 'Pablo', 'Quentin', 'Rose', 'Sacha', 'Théo', 'Ulysse', 'Victoire', 'Wassim', 'Xavier', 'Yanis', 'Zoé'];

function bot(i) {
    const name = `${PRENOMS[i % PRENOMS.length]}${i >= PRENOMS.length ? Math.floor(i / PRENOMS.length) + 1 : ''}`;
    const socket = io(url, { query: { type: 'player' } });
    let target = { x: 0, y: 0 };
    let alive = false;

    const join = () => socket.emit('join', { name, screenWidth: 1280, screenHeight: 720, token: 'bot-' + i });

    socket.on('connect', join);
    socket.on('welcome', () => { alive = true; });
    socket.on('gameStarted', () => { alive = true; });
    socket.on('joinError', (m) => console.log(`[${name}] refusé : ${m}`));
    socket.on('RIP', () => { alive = false; setTimeout(join, 3000 + Math.random() * 5000); });
    socket.on('kick', (r) => console.log(`[${name}] exclu : ${r}`));

    setInterval(() => {
        if (!alive) return;
        if (Math.random() < 0.3) target = { x: (Math.random() - 0.5) * 1200, y: (Math.random() - 0.5) * 800 };
        socket.emit('0', target);
    }, 100);
    setInterval(() => {
        if (!alive) return;
        const r = Math.random();
        if (r < 0.05) socket.emit('2');       // split
        else if (r < 0.08) socket.emit('1');  // nourrir
        else if (r < 0.12) socket.emit('3');  // rappel
    }, 1000);
}

for (let i = 0; i < count; i++) setTimeout(() => bot(i), i * 50);
console.log(`${count} bots en route vers ${url} (Ctrl+C pour arrêter)`);
