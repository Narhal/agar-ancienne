import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankEntries, mergeSnapshots, finalRanking } from '../src/server/score.js';

const snap = (entries) => ({ at: 0, entries: rankEntries(entries) });

test('rankEntries trie par masse décroissante, ignore les masses nulles et pose le rang', () => {
    const r = rankEntries([{ name: 'b', mass: 10 }, { name: 'a', mass: 30 }, { name: 'mort', mass: 0 }, { name: 'c', mass: 10 }]);
    assert.deepEqual(r, [
        { name: 'a', mass: 30, rank: 1 },
        { name: 'b', mass: 10, rank: 2 },
        { name: 'c', mass: 10, rank: 3 },
    ]);
});

test('formule somme : total des masses sur tous les snapshots', () => {
    const s = mergeSnapshots([snap([{ name: 'a', mass: 100 }, { name: 'b', mass: 50 }]), snap([{ name: 'a', mass: 20 }])], 'somme');
    assert.equal(s.get('a'), 120);
    assert.equal(s.get('b'), 50);
});

test('formule moyenne : divise par le nombre de snapshots, absence = 0', () => {
    const s = mergeSnapshots([snap([{ name: 'a', mass: 100 }, { name: 'b', mass: 50 }]), snap([{ name: 'a', mass: 20 }])], 'moyenne');
    assert.equal(s.get('a'), 60);
    assert.equal(s.get('b'), 25);
});

test('formule rangs : points par rang, 0 au-delà du barème et pour les morts', () => {
    const points = [25, 18, 15];
    const s = mergeSnapshots([
        snap([{ name: 'a', mass: 100 }, { name: 'b', mass: 50 }, { name: 'c', mass: 10 }, { name: 'd', mass: 5 }]),
        snap([{ name: 'b', mass: 90 }, { name: 'a', mass: 80 }]),
    ], 'rangs', points);
    assert.equal(s.get('a'), 25 + 18);
    assert.equal(s.get('b'), 18 + 25);
    assert.equal(s.get('c'), 15);
    assert.equal(s.get('d'), 0);
});

test('formule inconnue refusée', () => {
    assert.throws(() => mergeSnapshots([], 'magie'), /Formule inconnue/);
});

test('finalRanking combine snapshots, masse finale et kills avec les pondérations', () => {
    const ranking = finalRanking({
        players: [
            { name: 'a', finalMass: 100, kills: 2 },
            { name: 'b', finalMass: 300, kills: 0 },
        ],
        snapshots: [snap([{ name: 'a', mass: 100 }, { name: 'b', mass: 50 }])],
        formula: 'rangs',
        rankPoints: [25, 18],
        snapshotWeight: 10,
        finalMassWeight: 1,
        killValue: 50,
    });
    // a : 10*25 + 100 + 2*50 = 450 ; b : 10*18 + 300 = 480
    assert.equal(ranking[0].name, 'b');
    assert.equal(ranking[0].score, 480);
    assert.equal(ranking[0].rank, 1);
    assert.equal(ranking[1].name, 'a');
    assert.equal(ranking[1].score, 450);
    assert.equal(ranking[1].rank, 2);
});

test('finalRanking : un joueur sans snapshot ni masse a 0 et est classé dernier', () => {
    const ranking = finalRanking({
        players: [{ name: 'x', finalMass: 0, kills: 0 }, { name: 'y', finalMass: 10, kills: 0 }],
        snapshots: [], formula: 'somme', rankPoints: [],
    });
    assert.equal(ranking[1].name, 'x');
    assert.equal(ranking[1].score, 0);
});
