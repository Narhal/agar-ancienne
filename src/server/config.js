// Configuration du serveur. Chaque valeur peut être surchargée par une
// variable d'environnement (voir .env.example et docker-compose.yml).

const env = process.env;
const num = (key, fallback) => {
    const v = env[key];
    if (v === undefined || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};
const str = (key, fallback) => (env[key] === undefined || env[key] === '' ? fallback : env[key]);
const list = (key, fallback) => {
    const v = env[key];
    if (!v) return fallback;
    const parsed = v.split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x));
    return parsed.length ? parsed : fallback;
};

export const SCORE_FORMULAS = ['somme', 'moyenne', 'rangs'];

const formula = str('SCORE_FORMULA', 'rangs');

const config = {
    host: str('HOST', '0.0.0.0'),
    port: num('PORT', 3000),
    adminPass: str('ADMIN_PASS', 'changez-moi'),

    // Partie
    gameDurationMin: num('GAME_DURATION_MIN', 15),
    snapshotIntervalSec: num('SNAPSHOT_INTERVAL_SEC', 60),
    scoreFormula: SCORE_FORMULAS.includes(formula) ? formula : 'rangs',
    snapshotWeight: num('SNAPSHOT_WEIGHT', 1),
    finalMassWeight: num('FINAL_MASS_WEIGHT', 1),
    killValue: num('KILL_VALUE', 50),
    rankPoints: list('RANK_POINTS', [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]),

    // Rappel (se refondre)
    recallCooldownSec: num('RECALL_COOLDOWN_SEC', 8),
    recallDurationSec: num('RECALL_DURATION_SEC', 2.5),

    // Reconnexion
    reconnectGraceSec: num('RECONNECT_GRACE_SEC', 10),

    // Moteur (valeurs héritées de l'amont)
    foodMass: 1,
    fireFood: 20,
    limitSplit: 16,
    defaultPlayerMass: 10,
    virus: {
        fill: '#33ff33',
        stroke: '#19D119',
        strokeWidth: 20,
        defaultMass: { from: 100, to: 150 },
        splitMass: 180,
        uniformDisposition: false,
    },
    gameWidth: num('GAME_WIDTH', 5000),
    gameHeight: num('GAME_HEIGHT', 5000),
    gameMass: num('GAME_MASS', 20000),
    maxFood: num('MAX_FOOD', 1000),
    maxVirus: num('MAX_VIRUS', 50),
    slowBase: 4.5,
    logChat: num('LOG_CHAT', 0),
    networkUpdateFactor: 40,
    maxHeartbeatInterval: 5000,
    foodUniformDisposition: true,
    newPlayerInitialPosition: 'farthest',
    massLossRate: 1,
    minMassLoss: 50,

    dataDir: str('DATA_DIR', 'data'),
    partiesDir: str('PARTIES_DIR', 'parties'),
};

export default config;
