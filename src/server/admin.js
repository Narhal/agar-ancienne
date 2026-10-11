// Console d'administration HTTP (/admin) : connexion par mot de passe,
// pilotage de la partie, historique et exports.
//
// Sessions admin : jeton aléatoire en cookie httpOnly, gardé en mémoire,
// 12 h de validité. Les échecs sont journalisés et ralentis par IP.

import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { EXPORT_FILES } from './logs.js';

const SESSION_MS = 12 * 3600 * 1000;
const COOKIE = 'agar-ancienne_admin';

function parseCookies(header) {
    const out = {};
    for (const part of String(header ?? '').split(';')) {
        const i = part.indexOf('=');
        if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
}

function safeEqual(a, b) {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
}

export function checkPassword(given, expected) {
    return typeof given === 'string' && given.length > 0 && safeEqual(given, expected);
}

/**
 * @param {object} deps
 * @param {string} deps.adminPass
 * @param {object} deps.db
 * @param {object} deps.actions  start/stop/pause/resume/snapshot/settings/kick/message/state
 */
export function adminRouter({ adminPass, db, actions }) {
    const router = express.Router();
    const sessions = new Map(); // token -> expiresAt
    const failures = new Map(); // ip -> { count, until }

    router.use(express.json({ limit: '16kb' }));

    const clientIp = (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

    function requireAdmin(req, res, next) {
        const token = parseCookies(req.headers.cookie)[COOKIE];
        const expiresAt = token && sessions.get(token);
        if (!expiresAt || expiresAt < Date.now()) {
            if (token) sessions.delete(token);
            return res.status(401).json({ erreur: 'non_connecte' });
        }
        next();
    }

    router.post('/api/admin/login', (req, res) => {
        const ip = clientIp(req);
        const f = failures.get(ip);
        if (f && f.until > Date.now()) {
            return res.status(429).json({ erreur: 'trop_de_tentatives', attendre: Math.ceil((f.until - Date.now()) / 1000) });
        }
        if (!checkPassword(req.body?.password, adminPass)) {
            const count = (f?.count ?? 0) + 1;
            failures.set(ip, { count, until: Date.now() + Math.min(60_000, 1000 * 2 ** Math.min(count, 6)) });
            db.logFailedLogin('(page admin)', ip, 'http');
            console.log(`[ADMIN] Échec de connexion à la console depuis ${ip}`);
            return res.status(401).json({ erreur: 'mot_de_passe' });
        }
        failures.delete(ip);
        const token = randomBytes(32).toString('hex');
        sessions.set(token, Date.now() + SESSION_MS);
        res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}`);
        console.log(`[ADMIN] Connexion à la console depuis ${ip}`);
        res.json({ ok: true });
    });

    router.post('/api/admin/logout', (req, res) => {
        const token = parseCookies(req.headers.cookie)[COOKIE];
        if (token) sessions.delete(token);
        res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
        res.json({ ok: true });
    });

    router.get('/api/admin/state', requireAdmin, (req, res) => {
        res.json(actions.state());
    });

    router.post('/api/admin/start', requireAdmin, (req, res) => {
        const r = actions.start({ minutes: req.body?.minutes, snapshotSec: req.body?.snapshotSec });
        res.status(r.erreur ? 400 : 200).json(r);
    });

    for (const name of ['stop', 'pause', 'resume', 'snapshot']) {
        router.post(`/api/admin/${name}`, requireAdmin, (req, res) => {
            const r = actions[name]();
            res.status(r.erreur ? 400 : 200).json(r);
        });
    }

    router.post('/api/admin/settings', requireAdmin, (req, res) => {
        const r = actions.settings(req.body ?? {});
        res.status(r.erreur ? 400 : 200).json(r);
    });

    router.post('/api/admin/kick', requireAdmin, (req, res) => {
        const r = actions.kick(String(req.body?.name ?? ''), String(req.body?.reason ?? ''));
        res.status(r.erreur ? 400 : 200).json(r);
    });

    router.post('/api/admin/message', requireAdmin, (req, res) => {
        const r = actions.message(String(req.body?.text ?? '').slice(0, 200));
        res.status(r.erreur ? 400 : 200).json(r);
    });

    router.get('/api/admin/games', requireAdmin, (req, res) => {
        res.json({ games: db.listGames() });
    });

    router.get('/api/admin/games/:id', requireAdmin, (req, res) => {
        const result = db.getGame(req.params.id);
        if (!result) return res.status(404).json({ erreur: 'introuvable' });
        res.json(result);
    });

    router.get('/api/admin/games/:id/:file', requireAdmin, (req, res) => {
        const build = EXPORT_FILES[req.params.file];
        const result = build && db.getGame(req.params.id);
        if (!result) return res.status(404).json({ erreur: 'introuvable' });
        const isJson = req.params.file.endsWith('.json');
        res.setHeader('Content-Type', isJson ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.id}-${req.params.file}"`);
        res.send(build(result));
    });

    router.get('/api/admin/failed-logins', requireAdmin, (req, res) => {
        res.json({ attempts: db.listFailedLogins() });
    });

    return router;
}
