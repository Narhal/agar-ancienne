import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/server/game/player.js';

const SLOW_BASE = 4.5;
const INIT_MASS_LOG = Math.log(10) / Math.log(SLOW_BASE);

function bigPlayer() {
    const p = new Player('s1');
    p.init({ x: 2500, y: 2500 }, 10);
    p.changeCellMass(0, 190); // masse 200
    p.target = { x: 0, y: 0 };
    return p;
}

test('rappel refusé avec une seule cellule, accepté après un split, puis en cooldown', () => {
    const p = bigPlayer();
    assert.equal(p.recall(8000, 2500, 1000), 'une_seule_cellule');
    p.userSplit(16, 10);
    assert.equal(p.cells.length, 2);
    assert.equal(p.recall(8000, 2500, 1000), null);
    assert.equal(p.recallUntil, 3500);
    assert.equal(p.recallReadyAt, 9000);
    assert.equal(p.recall(8000, 2500, 2000), 'deja_en_cours');
    assert.equal(p.recall(8000, 2500, 5000), 'cooldown');
    assert.equal(p.recall(8000, 2500, 9000), null);
});

test('pendant un rappel, les cellules séparées se rejoignent et fusionnent avant les 15 s', () => {
    const p = bigPlayer();
    p.userSplit(16, 10);
    // On éloigne artificiellement la seconde cellule.
    p.cells[1].x += 150;
    p.cells[1].speed = 6.25;
    p.cells[0].speed = 6.25;
    const now = Date.now();
    assert.equal(p.recall(8000, 2500, now), null);
    for (let i = 0; i < 60 && p.cells.length > 1; i++) {
        p.move(SLOW_BASE, 5000, 5000, INIT_MASS_LOG);
    }
    assert.equal(p.cells.length, 1, 'les cellules ont fusionné');
    assert.ok(Math.abs(p.massTotal - 200) < 1e-6, 'la masse est conservée');
});

test('sans rappel, deux cellules fraîchement splittées ne fusionnent pas', () => {
    const p = bigPlayer();
    p.userSplit(16, 10);
    p.cells[1].x += 150;
    p.cells[1].speed = 6.25;
    p.cells[0].speed = 6.25;
    for (let i = 0; i < 60; i++) p.move(SLOW_BASE, 5000, 5000, INIT_MASS_LOG);
    assert.equal(p.cells.length, 2);
});

test('un split annule le rappel en cours', () => {
    const p = bigPlayer();
    p.userSplit(16, 10);
    p.recall(8000, 2500, Date.now());
    assert.equal(p.isRecalling, true);
    p.userSplit(16, 10);
    assert.equal(p.isRecalling, false);
});
