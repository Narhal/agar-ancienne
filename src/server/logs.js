// Exports de fin de partie : un dossier par partie dans `parties/`, avec le
// JSON complet, les CSV (classement, snapshots, kills) et un CSV importable
// dans N4Lan (pseudo;points;motif).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { versCsv } from './csv.js';

const fmtDuration = (ms) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function rankingCsv(result) {
    return versCsv(
        ['rang', 'pseudo', 'score', 'score_snapshots', 'masse_finale', 'kills', 'morts', 'masse_max', 'temps_en_vie', 'temps_connecte'],
        result.ranking.map((r) => [
            r.rank, r.name, r.score, r.snapshotScore, r.finalMass, r.kills, r.deaths, r.maxMass,
            fmtDuration(r.aliveMs), fmtDuration(r.connectedMs),
        ]),
    );
}

export function snapshotsCsv(result) {
    const rows = [];
    for (const s of result.snapshots) {
        for (const e of s.entries) {
            rows.push([s.index, fmtDuration(s.elapsedMs), new Date(s.at).toISOString(), e.rank, e.name, e.mass]);
        }
    }
    return versCsv(['snapshot', 'temps_de_jeu', 'horodatage', 'rang', 'pseudo', 'masse'], rows);
}

export function killsCsv(result) {
    return versCsv(
        ['temps_de_jeu', 'horodatage', 'mangeur', 'mange', 'masse_absorbee'],
        result.kills.map((k) => [fmtDuration(k.elapsedMs), new Date(k.at).toISOString(), k.killer, k.victim, k.mass]),
    );
}

// Format attendu par l'import de points de N4Lan.
export function n4lanCsv(result) {
    const motif = `Agar-ancienne partie ${result.id}`;
    return versCsv(['pseudo', 'points', 'motif'], result.ranking.map((r) => [r.name, r.score, motif]));
}

export const EXPORT_FILES = {
    'partie.json': (r) => JSON.stringify(r, null, 2),
    'classement.csv': rankingCsv,
    'snapshots.csv': snapshotsCsv,
    'kills.csv': killsCsv,
    'n4lan.csv': n4lanCsv,
};

export function writeGameFiles(result, partiesDir) {
    const dir = join(partiesDir, result.id);
    mkdirSync(dir, { recursive: true });
    for (const [name, build] of Object.entries(EXPORT_FILES)) {
        writeFileSync(join(dir, name), build(result), 'utf8');
    }
    return dir;
}
