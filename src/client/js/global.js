// État partagé du client.

const global = {
    KEY_ESC: 27,
    KEY_ENTER: 13,
    KEY_LEFT: 37,
    KEY_UP: 38,
    KEY_RIGHT: 39,
    KEY_DOWN: 40,

    borderDraw: false,
    mobile: false,
    screen: { width: window.innerWidth, height: window.innerHeight },
    game: { width: 0, height: 0 },
    gameStart: false,
    kicked: false,
    continuity: false,
    startPingTime: 0,
    toggleMassState: 0,
    foodSides: 10,
    backgroundColor: '#f2fbff',
    lineColor: '#000000',

    playerName: '',
    playerType: 'player',
    socket: null,
    player: null,
    target: { x: 0, y: 0 },
    canvas: null,
    chatClient: null,
    animLoopHandle: null,

    recall: { cooldownMs: 8000, durationMs: 2500, readyAt: 0, until: 0 },
    clock: null,
    leaderboard: null,
    boardOpen: false,
    gamepadActive: false,
};

export default global;
