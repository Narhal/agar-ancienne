// Cycle de vie d'une partie et statistiques par joueur.
//
// Ce module ne connaît ni les sockets ni la carte : le serveur lui passe le
// temps et la liste des joueurs vivants, il rend ce qui s'est passé. Cela le
// rend testable sans réseau (test/game.test.js).
//
// États : lobby (échauffement libre, rien n'est compté) -> running -> paused
//         -> ended (classement final affiché, attente d'un nouveau -start).

import { randomBytes } from 'node:crypto';
import { rankEntries, finalRanking, FORMULAS } from './score.js';
import { normaliser } from './pseudo.js';

export const STATES = ['lobby', 'running', 'paused', 'ended'];

function newStat(name) {
    return {
        name,
        kills: 0,
        deaths: 0,
        maxMass: 0,
        lastMass: 0,
        aliveMs: 0,
        connectedMs: 0,
        aliveSince: null,
        connectedSince: null,
    };
}

export class Game {
    constructor(config, { now = () => Date.now() } = {}) {
        this.now = now;
        this.state = 'lobby';
        this.settings = {
            durationMs: config.gameDurationMin * 60_000,
            snapshotIntervalMs: config.snapshotIntervalSec * 1000,
            formula: config.scoreFormula,
            rankPoints: [...config.rankPoints],
            snapshotWeight: config.snapshotWeight,
            finalMassWeight: config.finalMassWeight,
            killValue: config.killValue,
        };
        this.id = null;
        this.startedAt = null;
        this.endsAt = null;
        this.endedAt = null;
        this.pausedAt = null;
        this.nextSnapshotAt = null;
        this.snapshots = [];
        this.kills = [];
        this.stats = new Map(); // normalise -> stat
        this.lastResult = null;
    }

    get isCounting() {
        return this.state === 'running';
    }

    get isFrozen() {
        return this.state === 'paused' || this.state === 'ended';
    }

    // ----- Réglages (admin) -----

    updateSettings(patch) {
        const s = this.settings;
        const errors = [];
        if (patch.formula !== undefined) {
            if (FORMULAS.includes(patch.formula)) s.formula = patch.formula;
            else errors.push('formule');
        }
        for (const key of ['snapshotWeight', 'finalMassWeight', 'killValue']) {
            if (patch[key] !== undefined) {
                const n = Number(patch[key]);
                if (Number.isFinite(n) && n >= 0) s[key] = n;
                else errors.push(key);
            }
        }
        if (patch.rankPoints !== undefined) {
            const list = Array.isArray(patch.rankPoints) ? patch.rankPoints : String(patch.rankPoints).split(',');
            const nums = list.map((x) => Number(String(x).trim())).filter((x) => Number.isFinite(x) && x >= 0);
            if (nums.length > 0) s.rankPoints = nums;
            else errors.push('rankPoints');
        }
        if (patch.durationMin !== undefined) {
            const n = Number(patch.durationMin);
            if (Number.isFinite(n) && n >= 0.5 && n <= 600) s.durationMs = Math.round(n * 60_000);
            else errors.push('durationMin');
        }
        if (patch.snapshotSec !== undefined) {
            const n = Number(patch.snapshotSec);
            if (Number.isFinite(n) && n >= 5 && n <= 3600) s.snapshotIntervalMs = Math.round(n * 1000);
            else errors.push('snapshotSec');
        }
        return errors;
    }

    // ----- Cycle de vie -----

    /** Démarre une partie. `connectedNames` : pseudos des joueurs déjà présents. */
    start({ durationMs, snapshotIntervalMs } = {}, connectedNames = []) {
        const now = this.now();
        if (durationMs) this.settings.durationMs = durationMs;
        if (snapshotIntervalMs) this.settings.snapshotIntervalMs = snapshotIntervalMs;
        this.id = new Date(now).toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/(\d{8})(\d{4})/, '$1-$2')
            + '-' + randomBytes(2).toString('hex');
        this.state = 'running';
        this.startedAt = now;
        this.endedAt = null;
        this.pausedAt = null;
        this.endsAt = now + this.settings.durationMs;
        this.nextSnapshotAt = now + this.settings.snapshotIntervalMs;
        this.snapshots = [];
        this.kills = [];
        this.stats = new Map();
        this.lastResult = null;
        for (const name of connectedNames) {
            this.recordConnect(name);
            this.recordSpawn(name);
        }
        return this.id;
    }

    pause() {
        if (this.state !== 'running') return false;
        this.state = 'paused';
        this.pausedAt = this.now();
        return true;
    }

    resume() {
        if (this.state !== 'paused') return false;
        const pausedFor = this.now() - this.pausedAt;
        this.endsAt += pausedFor;
        this.nextSnapshotAt += pausedFor;
        // Les compteurs de temps ne doivent pas inclure la pause.
        for (const s of this.stats.values()) {
            if (s.aliveSince !== null) s.aliveSince += pausedFor;
            if (s.connectedSince !== null) s.connectedSince += pausedFor;
        }
        this.pausedAt = null;
        this.state = 'running';
        return true;
    }

    remainingMs(now = this.now()) {
        if (this.state === 'running') return Math.max(0, this.endsAt - now);
        if (this.state === 'paused') return Math.max(0, this.endsAt - this.pausedAt);
        return 0;
    }

    /**
     * À appeler régulièrement avec les joueurs vivants [{ name, mass }].
     * Rend { snapshot } si un snapshot vient d'être pris, { ended, result } si la
     * partie vient de se terminer.
     */
    tick(alivePlayers) {
        if (this.state !== 'running') return {};
        const now = this.now();
        const out = {};
        for (const p of alivePlayers) {
            const s = this.statFor(p.name);
            s.lastMass = p.mass;
            if (p.mass > s.maxMass) s.maxMass = p.mass;
        }
        if (now >= this.nextSnapshotAt) {
            out.snapshot = this.takeSnapshot(alivePlayers);
            this.nextSnapshotAt += this.settings.snapshotIntervalMs;
            if (this.nextSnapshotAt <= now) this.nextSnapshotAt = now + this.settings.snapshotIntervalMs;
        }
        if (now >= this.endsAt) {
            out.ended = true;
            out.result = this.finish(alivePlayers);
        }
        return out;
    }

    takeSnapshot(alivePlayers) {
        const snapshot = {
            index: this.snapshots.length + 1,
            at: this.now(),
            elapsedMs: this.now() - this.startedAt,
            entries: rankEntries(alivePlayers.map((p) => ({ name: p.name, mass: p.mass }))),
        };
        this.snapshots.push(snapshot);
        return snapshot;
    }

    /** Termine la partie (fin de temps ou -stop) et calcule le classement final. */
    finish(alivePlayers) {
        if (this.state !== 'running' && this.state !== 'paused') return this.lastResult;
        const now = this.now();
        if (this.state === 'paused') this.resume();
        const alive = new Map(alivePlayers.map((p) => [normaliser(p.name), p.mass]));
        for (const [key, s] of this.stats) {
            if (s.aliveSince !== null) { s.aliveMs += now - s.aliveSince; s.aliveSince = null; }
            if (s.connectedSince !== null) { s.connectedMs += now - s.connectedSince; s.connectedSince = null; }
            s.finalMass = alive.get(key) ?? 0;
        }
        const ranking = finalRanking({
            players: [...this.stats.values()],
            snapshots: this.snapshots,
            formula: this.settings.formula,
            rankPoints: this.settings.rankPoints,
            snapshotWeight: this.settings.snapshotWeight,
            finalMassWeight: this.settings.finalMassWeight,
            killValue: this.settings.killValue,
        });
        this.state = 'ended';
        this.endedAt = now;
        this.lastResult = {
            id: this.id,
            startedAt: new Date(this.startedAt).toISOString(),
            endedAt: new Date(now).toISOString(),
            durationMs: now - this.startedAt,
            plannedDurationMs: this.settings.durationMs,
            settings: { ...this.settings, rankPoints: [...this.settings.rankPoints] },
            ranking,
            snapshots: this.snapshots,
            kills: this.kills,
        };
        return this.lastResult;
    }

    // ----- Statistiques -----

    statFor(name) {
        const key = normaliser(name);
        let s = this.stats.get(key);
        if (!s) {
            s = newStat(name);
            this.stats.set(key, s);
        }
        return s;
    }

    recordConnect(name) {
        if (!this.isCounting) return;
        const s = this.statFor(name);
        if (s.connectedSince === null) s.connectedSince = this.now();
    }

    recordDisconnect(name) {
        if (!this.isCounting) return;
        const s = this.stats.get(normaliser(name));
        if (!s) return;
        const now = this.now();
        if (s.connectedSince !== null) { s.connectedMs += now - s.connectedSince; s.connectedSince = null; }
        if (s.aliveSince !== null) { s.aliveMs += now - s.aliveSince; s.aliveSince = null; }
    }

    recordSpawn(name) {
        if (!this.isCounting) return;
        const s = this.statFor(name);
        if (s.aliveSince === null) s.aliveSince = this.now();
    }

    recordDeath(name) {
        if (!this.isCounting) return;
        const s = this.statFor(name);
        s.deaths += 1;
        s.lastMass = 0;
        if (s.aliveSince !== null) { s.aliveMs += this.now() - s.aliveSince; s.aliveSince = null; }
    }

    recordKill(killerName, victimName, mass) {
        if (!this.isCounting) return;
        const s = this.statFor(killerName);
        s.kills += 1;
        this.kills.push({
            at: this.now(),
            elapsedMs: this.now() - this.startedAt,
            killer: killerName,
            victim: victimName,
            mass: Math.round(mass),
        });
    }

    /** Classement provisoire pendant la partie, avec le score calculé comme en fin de partie. */
    provisionalRanking(alivePlayers) {
        const alive = new Map(alivePlayers.map((p) => [normaliser(p.name), p.mass]));
        const players = [];
        const seen = new Set();
        for (const [key, s] of this.stats) {
            seen.add(key);
            players.push({ ...s, finalMass: alive.get(key) ?? 0 });
        }
        for (const p of alivePlayers) {
            const key = normaliser(p.name);
            if (!seen.has(key)) players.push({ ...newStat(p.name), finalMass: p.mass });
        }
        return finalRanking({
            players,
            snapshots: this.snapshots,
            formula: this.settings.formula,
            rankPoints: this.settings.rankPoints,
            snapshotWeight: this.settings.snapshotWeight,
            finalMassWeight: this.settings.finalMassWeight,
            killValue: this.settings.killValue,
        });
    }

    clock() {
        const now = this.now();
        return {
            state: this.state,
            id: this.id,
            remainingMs: this.remainingMs(now),
            durationMs: this.settings.durationMs,
            snapshotIntervalMs: this.settings.snapshotIntervalMs,
            nextSnapshotMs: this.state === 'running' ? Math.max(0, this.nextSnapshotAt - now) : null,
            snapshotCount: this.snapshots.length,
            formula: this.settings.formula,
            serverNow: now,
        };
    }
}
