import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerPseudo, normaliser } from '../src/server/pseudo.js';
import { rankingCsv, n4lanCsv, snapshotsCsv, killsCsv } from '../src/server/logs.js';
import { analyserCsv } from '../src/server/csv.js';
import { checkPassword } from '../src/server/admin.js';

test('normaliser : casse, accents, espaces et tirets ignorés', () => {
    assert.equal(normaliser('Kévin'), 'kevin');
    assert.equal(normaliser('Le Kevin'), normaliser('le_kevin'));
});

test('validerPseudo : règles de longueur, caractères et pseudos réservés', () => {
    assert.equal(validerPseudo('K').ok, false);
    assert.equal(validerPseudo('x'.repeat(21)).ok, false);
    assert.equal(validerPseudo('<script>').ok, false);
    assert.equal(validerPseudo('Admin').motif, 'reserve');
    const ok = validerPseudo('  Jean-Luc  ');
    assert.equal(ok.ok, true);
    assert.equal(ok.pseudo, 'Jean-Luc');
    assert.equal(ok.normalise, 'jeanluc');
});

const result = {
    id: '20261011-2200-ab12',
    ranking: [
        { rank: 1, name: 'Alice', score: 300, snapshotScore: 50, finalMass: 200, kills: 1, deaths: 0, maxMass: 210, aliveMs: 61_000, connectedMs: 65_000 },
        { rank: 2, name: '=Bob', score: 20, snapshotScore: 0, finalMass: 20, kills: 0, deaths: 2, maxMass: 30, aliveMs: 1_000, connectedMs: 2_000 },
    ],
    snapshots: [{ index: 1, at: 1_000, elapsedMs: 60_000, entries: [{ name: 'Alice', mass: 100, rank: 1 }] }],
    kills: [{ at: 2_000, elapsedMs: 30_000, killer: 'Alice', victim: '=Bob', mass: 150 }],
};

test('classement.csv : en-têtes, lignes, durées et neutralisation des formules', () => {
    const csv = rankingCsv(result);
    assert.ok(csv.startsWith('﻿rang;pseudo;score'));
    const rows = analyserCsv(csv);
    assert.equal(rows.length, 3);
    assert.equal(rows[1][1], 'Alice');
    assert.equal(rows[1][8], '1:01');
    assert.equal(rows[2][1], '=Bob', 'l’apostrophe de protection est retirée à la relecture');
    assert.ok(csv.includes('"\'=Bob"'), 'la cellule brute est protégée contre Excel');
});

test('n4lan.csv : format pseudo;points;motif attendu par l’import N4Lan', () => {
    const rows = analyserCsv(n4lanCsv(result));
    assert.deepEqual(rows[0], ['pseudo', 'points', 'motif']);
    assert.deepEqual(rows[1], ['Alice', '300', 'N4Agar partie 20261011-2200-ab12']);
});

test('snapshots.csv et kills.csv : une ligne par entrée', () => {
    assert.equal(analyserCsv(snapshotsCsv(result)).length, 2);
    const kills = analyserCsv(killsCsv(result));
    assert.equal(kills.length, 2);
    assert.equal(kills[1][2], 'Alice');
});

test('checkPassword : comparaison stricte, refus du vide et des types étranges', () => {
    assert.equal(checkPassword('secret', 'secret'), true);
    assert.equal(checkPassword('secre', 'secret'), false);
    assert.equal(checkPassword('', ''), false);
    assert.equal(checkPassword(undefined, 'secret'), false);
    assert.equal(checkPassword({ toString: () => 'secret' }, 'secret'), false);
});
