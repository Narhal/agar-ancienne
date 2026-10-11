// Calcul du score : fonctions pures, sans état, testées dans test/score.test.js.
//
// Un snapshot est { at, entries: [{ name, mass, rank }] } ; un joueur mort ou
// déconnecté au moment du snapshot n'y figure pas (il compte 0, décision D7).
//
// Score final = snapshotWeight * scoreSnapshots
//             + finalMassWeight * masse finale
//             + killValue * kills

export const FORMULAS = ['somme', 'moyenne', 'rangs'];

// Classe des entrées { name, mass } par masse décroissante et pose le rang (1 = premier).
export function rankEntries(entries) {
    return [...entries]
        .filter((e) => e.mass > 0)
        .sort((a, b) => b.mass - a.mass || a.name.localeCompare(b.name))
        .map((e, i) => ({ name: e.name, mass: Math.round(e.mass), rank: i + 1 }));
}

// Points d'un snapshot pour une entrée, selon la formule.
function pointsFor(entry, formula, rankPoints) {
    switch (formula) {
        case 'somme':
        case 'moyenne':
            return entry.mass;
        case 'rangs':
            return rankPoints[entry.rank - 1] ?? 0;
        default:
            throw new Error(`Formule inconnue : ${formula}`);
    }
}

/**
 * Fusionne les snapshots : Map pseudo -> score de snapshots.
 * « moyenne » divise par le nombre total de snapshots, absences comprises.
 */
export function mergeSnapshots(snapshots, formula, rankPoints = []) {
    if (!FORMULAS.includes(formula)) throw new Error(`Formule inconnue : ${formula}`);
    const totals = new Map();
    for (const snapshot of snapshots) {
        for (const entry of snapshot.entries) {
            totals.set(entry.name, (totals.get(entry.name) ?? 0) + pointsFor(entry, formula, rankPoints));
        }
    }
    if (formula === 'moyenne' && snapshots.length > 0) {
        for (const [name, total] of totals) totals.set(name, total / snapshots.length);
    }
    return totals;
}

/**
 * Classement final.
 * @param {Array<{name, finalMass, kills, deaths?, maxMass?, aliveMs?, connectedMs?}>} players
 */
export function finalRanking({ players, snapshots, formula, rankPoints, snapshotWeight = 1, finalMassWeight = 1, killValue = 0 }) {
    const snapshotScores = mergeSnapshots(snapshots, formula, rankPoints);
    const rows = players.map((p) => {
        const snapshotScore = snapshotScores.get(p.name) ?? 0;
        const finalMass = Math.round(p.finalMass ?? 0);
        const kills = p.kills ?? 0;
        const score = Math.round(snapshotWeight * snapshotScore + finalMassWeight * finalMass + killValue * kills);
        return {
            name: p.name,
            score,
            snapshotScore: Math.round(snapshotScore * 100) / 100,
            finalMass,
            kills,
            deaths: p.deaths ?? 0,
            maxMass: Math.round(p.maxMass ?? 0),
            aliveMs: p.aliveMs ?? 0,
            connectedMs: p.connectedMs ?? 0,
        };
    });
    rows.sort((a, b) => b.score - a.score || b.finalMass - a.finalMass || b.kills - a.kills || a.name.localeCompare(b.name));
    return rows.map((r, i) => ({ rank: i + 1, ...r }));
}
