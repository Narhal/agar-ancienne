// Base SQLite embarquée (node:sqlite, sans module natif à compiler).
// Historique des parties, chat et tentatives de connexion admin.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function openDatabase(dataDir) {
    mkdirSync(dataDir, { recursive: true });
    const db = new DatabaseSync(join(dataDir, 'n4agar.sqlite'));
    db.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            started_at TEXT NOT NULL,
            ended_at TEXT NOT NULL,
            duration_ms INTEGER NOT NULL,
            player_count INTEGER NOT NULL,
            winner TEXT,
            formula TEXT,
            result TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
            at TEXT NOT NULL,
            game_id TEXT,
            username TEXT,
            message TEXT,
            ip_address TEXT
        );
        CREATE TABLE IF NOT EXISTS failed_logins (
            at TEXT NOT NULL,
            username TEXT,
            ip_address TEXT,
            via TEXT
        );
    `);

    const insertGame = db.prepare(`INSERT OR REPLACE INTO games
        (id, started_at, ended_at, duration_ms, player_count, winner, formula, result)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const listGames = db.prepare(`SELECT id, started_at, ended_at, duration_ms, player_count, winner, formula
        FROM games ORDER BY started_at DESC LIMIT 200`);
    const getGame = db.prepare('SELECT result FROM games WHERE id = ?');
    const insertChat = db.prepare('INSERT INTO chat_messages (at, game_id, username, message, ip_address) VALUES (?, ?, ?, ?, ?)');
    const insertFailed = db.prepare('INSERT INTO failed_logins (at, username, ip_address, via) VALUES (?, ?, ?, ?)');
    const listFailed = db.prepare('SELECT at, username, ip_address, via FROM failed_logins ORDER BY at DESC LIMIT 100');

    return {
        saveGame(result) {
            insertGame.run(
                result.id, result.startedAt, result.endedAt, result.durationMs,
                result.ranking.length, result.ranking[0]?.name ?? null, result.settings.formula,
                JSON.stringify(result),
            );
        },
        listGames() {
            return listGames.all();
        },
        getGame(id) {
            const row = getGame.get(id);
            return row ? JSON.parse(row.result) : null;
        },
        logChat(gameId, username, message, ip) {
            insertChat.run(new Date().toISOString(), gameId, username, message, ip);
        },
        logFailedLogin(username, ip, via) {
            insertFailed.run(new Date().toISOString(), username, ip, via);
        },
        listFailedLogins() {
            return listFailed.all();
        },
        close() {
            db.close();
        },
    };
}
