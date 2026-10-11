import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/server/game.js';

const baseConfig = {
    gameDurationMin: 1,
    snapshotIntervalSec: 10,
    scoreFormula: 'rangs',
    rankPoints: [25, 18, 15],
    snapshotWeight: 1,
    finalMassWeight: 1,
    killValue: 50,
};

function makeGame() {
    let t = 1_000_000;
    const clock = { now: () => t, advance: (ms) => { t += ms; } };
    const game = new Game(baseConfig, { now: clock.now });
    return { game, clock };
}

test('démarre en lobby, rien n’est compté avant -start', () => {
    const { game } = makeGame();
    assert.equal(game.state, 'lobby');
    game.recordKill('a', 'b', 50);
    game.recordDeath('b');
    assert.equal(game.stats.size, 0);
    assert.deepEqual(game.tick([{ name: 'a', mass: 10 }]), {});
});

test('cycle complet : snapshots à intervalle, fin au temps écoulé, classement final', () => {
    const { game, clock } = makeGame();
    game.start({ durationMs: 30_000, snapshotIntervalMs: 10_000 }, ['Alice', 'Bob']);
    assert.equal(game.state, 'running');
    assert.equal(game.remainingMs(), 30_000);

    clock.advance(10_000);
    let out = game.tick([{ name: 'Alice', mass: 100 }, { name: 'Bob', mass: 50 }]);
    assert.equal(out.snapshot.index, 1);
    assert.equal(out.snapshot.entries[0].name, 'Alice');

    game.recordKill('Bob', 'Alice', 150);
    game.recordDeath('Alice');

    clock.advance(10_000);
    out = game.tick([{ name: 'Bob', mass: 150 }]);
    assert.equal(out.snapshot.index, 2);
    assert.equal(out.snapshot.entries.length, 1, 'Alice morte ne figure pas dans le snapshot');

    clock.advance(10_000);
    out = game.tick([{ name: 'Bob', mass: 160 }, { name: 'Alice', mass: 10 }]);
    assert.equal(out.snapshot.index, 3);
    assert.equal(out.ended, true);
    assert.equal(game.state, 'ended');

    const r = out.result;
    assert.equal(r.ranking.length, 2);
    // Bob : rangs 18 + 25 + 25 = 68, masse finale 160, 1 kill * 50 = 278
    assert.equal(r.ranking[0].name, 'Bob');
    assert.equal(r.ranking[0].score, 68 + 160 + 50);
    assert.equal(r.ranking[0].kills, 1);
    // Alice : 25 + 0 + 18 = 43, masse finale 10, 0 kill = 53
    assert.equal(r.ranking[1].name, 'Alice');
    assert.equal(r.ranking[1].score, 43 + 10);
    assert.equal(r.ranking[1].deaths, 1);
    assert.equal(r.kills.length, 1);
    assert.equal(r.snapshots.length, 3);
});

test('pause : le temps restant et le prochain snapshot sont décalés', () => {
    const { game, clock } = makeGame();
    game.start({ durationMs: 60_000, snapshotIntervalMs: 20_000 }, []);
    clock.advance(5_000);
    assert.equal(game.pause(), true);
    assert.equal(game.state, 'paused');
    clock.advance(30_000);
    assert.equal(game.remainingMs(), 55_000);
    assert.deepEqual(game.tick([]), {}, 'pas de tick en pause');
    assert.equal(game.resume(), true);
    assert.equal(game.remainingMs(), 55_000);
    assert.equal(game.clock().nextSnapshotMs, 15_000);
    assert.equal(game.pause() && game.resume(), true);
    assert.equal(game.resume(), false);
});

test('un joueur arrivé en cours de partie est classé avec les snapshots qu’il a vus', () => {
    const { game, clock } = makeGame();
    game.start({ durationMs: 20_000, snapshotIntervalMs: 10_000 }, ['Alice']);
    clock.advance(10_000);
    game.tick([{ name: 'Alice', mass: 100 }]);
    game.recordConnect('Zoé');
    game.recordSpawn('Zoé');
    clock.advance(10_000);
    const out = game.tick([{ name: 'Alice', mass: 100 }, { name: 'Zoé', mass: 200 }]);
    const byName = Object.fromEntries(out.result.ranking.map((r) => [r.name, r]));
    assert.equal(byName['Zoé'].snapshotScore, 25);
    assert.equal(byName['Alice'].snapshotScore, 25 + 18);
    assert.equal(byName['Zoé'].aliveMs, 10_000);
    assert.equal(byName['Alice'].aliveMs, 20_000);
});

test('les pseudos sont regroupés sans tenir compte de la casse ni des accents', () => {
    const { game, clock } = makeGame();
    game.start({ durationMs: 10_000, snapshotIntervalMs: 10_000 }, ['Kévin']);
    game.recordKill('KEVIN', 'x', 10);
    clock.advance(10_000);
    const out = game.tick([{ name: 'kevin', mass: 40 }]);
    assert.equal(out.result.ranking.length, 1);
    assert.equal(out.result.ranking[0].kills, 1);
    assert.equal(out.result.ranking[0].finalMass, 40);
});

test('stop anticipé : finish calcule le classement et passe en ended', () => {
    const { game, clock } = makeGame();
    game.start({ durationMs: 600_000, snapshotIntervalMs: 60_000 }, ['A']);
    clock.advance(1_000);
    const r = game.finish([{ name: 'A', mass: 33 }]);
    assert.equal(game.state, 'ended');
    assert.equal(r.durationMs, 1_000);
    assert.equal(r.ranking[0].finalMass, 33);
    assert.equal(game.finish([]), r, 'un second finish ne recalcule pas');
});

test('updateSettings valide chaque champ et rend la liste des champs refusés', () => {
    const { game } = makeGame();
    assert.deepEqual(game.updateSettings({ formula: 'moyenne', killValue: 10, rankPoints: '5, 3, x, 1', durationMin: 2, snapshotSec: 30 }), []);
    assert.equal(game.settings.formula, 'moyenne');
    assert.deepEqual(game.settings.rankPoints, [5, 3, 1]);
    assert.equal(game.settings.durationMs, 120_000);
    assert.equal(game.settings.snapshotIntervalMs, 30_000);
    assert.deepEqual(game.updateSettings({ formula: 'magie', killValue: -1, durationMin: 0, snapshotSec: 1 }), ['formule', 'killValue', 'durationMin', 'snapshotSec']);
    assert.equal(game.settings.formula, 'moyenne', 'valeur refusée non appliquée');
});

test('classement provisoire : score calculé comme en fin de partie, morts à 0 de masse', () => {
    const { game, clock } = makeGame();
    game.start({ durationMs: 60_000, snapshotIntervalMs: 10_000 }, ['A', 'B']);
    clock.advance(10_000);
    game.tick([{ name: 'A', mass: 100 }, { name: 'B', mass: 50 }]);
    game.recordDeath('B');
    const p = game.provisionalRanking([{ name: 'A', mass: 120 }]);
    assert.equal(p[0].name, 'A');
    assert.equal(p[0].score, 25 + 120);
    assert.equal(p[1].name, 'B');
    assert.equal(p[1].score, 18);
});
