// Page /classement : écran TV ou vidéoprojecteur, lecture seule.

const $ = (id) => document.getElementById(id);
const STATE_LABELS = { lobby: 'Échauffement', running: 'Partie en cours', paused: 'Pause', ended: 'Partie terminée' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

let clock = null;
const socket = io({ query: { type: 'board' } });

socket.on('leaderboard', (data) => {
    const board = $('board');
    let html = '<div class="row head"><span>#</span><span>Joueur</span><span class="num">Masse</span><span class="num">Kills</span><span class="num">Score</span></div>';
    for (const r of data.all) {
        html += '<div class="row' + (r.alive ? '' : ' dead') + '"><span class="rank">' + r.rank + '</span><span class="name">' + esc(r.name) + '</span>'
            + '<span class="num">' + r.mass + '</span><span class="num">' + r.kills + '</span><span class="num">' + (r.score === null ? '—' : r.score) + '</span></div>';
    }
    board.innerHTML = html;
    $('players').textContent = data.players + ' joueur' + (data.players > 1 ? 's' : '') + ' en jeu';
});

socket.on('clock', (c) => {
    clock = { ...c, receivedAt: Date.now() };
    $('state').textContent = STATE_LABELS[c.state] || c.state;
    $('snap').textContent = c.state === 'running' && c.nextSnapshotMs !== null ? 'Snapshot ' + (c.snapshotCount + 1) + ' dans ' + fmt(c.nextSnapshotMs) : '';
    $('formula').textContent = 'Formule : ' + c.formula + ' · ' + c.snapshotCount + ' snapshots';
    if (c.state !== 'ended') $('winner').classList.remove('show');
});

socket.on('gameEnded', (data) => {
    const w = data.ranking[0];
    if (!w) return;
    $('winner-name').textContent = w.name;
    $('winner-score').textContent = w.score + ' points · ' + w.kills + ' kills · masse finale ' + w.finalMass;
    $('winner').classList.add('show');
});

$('winner-close').onclick = () => $('winner').classList.remove('show');

function tick() {
    const el = $('time');
    if (clock) {
        let remaining = clock.remainingMs;
        if (clock.state === 'running') remaining -= Date.now() - clock.receivedAt;
        if (clock.state === 'lobby') el.textContent = fmt(clock.durationMs);
        else if (clock.state === 'ended') el.textContent = '0:00';
        else el.textContent = fmt(remaining);
        el.classList.toggle('urgent', clock.state === 'running' && remaining <= 10_000);
    }
    requestAnimationFrame(tick);
}
tick();
