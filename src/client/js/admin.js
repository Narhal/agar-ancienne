// Console admin : pilotage par l'API HTTP, rafraîchie toutes les secondes.

const $ = (id) => document.getElementById(id);
const STATE_LABELS = { lobby: 'Échauffement', running: 'Partie en cours', paused: 'Pause', ended: 'Partie terminée' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmt = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

let clock = null;
let lastState = null;
let settingsDirty = false;
let timer = null;

async function api(path, body) {
    const res = await fetch('/api/admin/' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { showLogin(); throw new Error('non_connecte'); }
    if (!res.ok) throw new Error(data.erreur ? data.erreur + (data.champs ? ' (' + data.champs.join(', ') + ')' : '') : 'erreur ' + res.status);
    return data;
}

function showLogin() {
    clearInterval(timer);
    $('login').classList.remove('hidden');
    $('console').classList.add('hidden');
    $('logout').classList.add('hidden');
}

function showConsole() {
    $('login').classList.add('hidden');
    $('console').classList.remove('hidden');
    $('logout').classList.remove('hidden');
    refresh();
    loadGames();
    loadFailed();
    clearInterval(timer);
    timer = setInterval(refresh, 1000);
}

$('login-btn').onclick = async () => {
    $('msg').textContent = '';
    try {
        await api('login', { password: $('password').value });
        $('password').value = '';
        showConsole();
    } catch (e) {
        $('msg').textContent = e.message === 'trop_de_tentatives' ? 'Trop de tentatives, patientez.' : 'Mot de passe refusé.';
    }
};
$('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('login-btn').click(); });
$('logout').onclick = async () => { await api('logout', {}); showLogin(); };

function note(text, ok = true) {
    const el = $('console-msg');
    el.style.color = ok ? '#7fd8a5' : '#ff6b6b';
    el.textContent = text;
    setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 4000);
}

async function act(path, body = {}) {
    try {
        const r = await api(path, body);
        note('OK : ' + path + (r.id ? ' (' + r.id + ')' : ''));
        refresh();
        if (path === 'stop') setTimeout(loadGames, 500);
    } catch (e) {
        note('Refusé : ' + e.message, false);
    }
}

$('start').onclick = () => act('start', { minutes: Number($('minutes').value), snapshotSec: Number($('snapshotSec').value) });
$('pause').onclick = () => act('pause');
$('resume').onclick = () => act('resume');
$('snapshot').onclick = () => act('snapshot');
$('stop').onclick = () => { if (confirm('Terminer la partie maintenant ? Le classement final sera calculé et exporté.')) act('stop'); };
$('send').onclick = () => { act('message', { text: $('message').value }); $('message').value = ''; };
$('save-settings').onclick = async () => {
    await act('settings', {
        formula: $('formula').value,
        snapshotWeight: Number($('snapshotWeight').value),
        finalMassWeight: Number($('finalMassWeight').value),
        killValue: Number($('killValue').value),
        rankPoints: $('rankPoints').value,
    });
    settingsDirty = false;
};
for (const id of ['formula', 'snapshotWeight', 'finalMassWeight', 'killValue', 'rankPoints']) {
    $(id).addEventListener('input', () => { settingsDirty = true; });
}

async function refresh() {
    let s;
    try { s = await api('state'); } catch { return; }
    clock = { ...s.clock, receivedAt: Date.now() };
    if (lastState !== null && lastState !== s.clock.state && s.clock.state === 'ended') setTimeout(loadGames, 500);
    lastState = s.clock.state;
    $('state').textContent = STATE_LABELS[s.clock.state] || s.clock.state;
    $('snap').textContent = s.clock.state === 'running' ? 'Snapshot ' + (s.clock.snapshotCount + 1) + ' dans ' + fmt(s.clock.nextSnapshotMs) + ' · ' + s.clock.snapshotCount + ' pris' : (s.lastResult ? 'Dernière partie : ' + s.lastResult.id + ', vainqueur ' + s.lastResult.winner : '');

    const running = s.clock.state === 'running';
    const paused = s.clock.state === 'paused';
    $('start').disabled = running || paused;
    $('pause').disabled = !running;
    $('resume').disabled = !paused;
    $('snapshot').disabled = !running;
    $('stop').disabled = !(running || paused);

    if (!settingsDirty) {
        if (document.activeElement !== $('minutes')) $('minutes').value = s.settings.durationMin;
        if (document.activeElement !== $('snapshotSec')) $('snapshotSec').value = s.settings.snapshotSec;
        $('formula').value = s.settings.formula;
        $('snapshotWeight').value = s.settings.snapshotWeight;
        $('finalMassWeight').value = s.settings.finalMassWeight;
        $('killValue').value = s.settings.killValue;
        $('rankPoints').value = s.settings.rankPoints.join(', ');
    }

    const pb = $('players').querySelector('tbody');
    pb.innerHTML = s.players.map((p) => '<tr><td>' + esc(p.name) + (p.admin ? '<span class="tag adm">admin</span>' : '') + '</td><td>' + esc(p.ip) + '</td>'
        + '<td class="num">' + p.mass + '</td><td class="num">' + p.kills + '</td>'
        + '<td>' + (p.disconnected ? '<span class="tag off">déconnecté</span>' : (p.alive ? 'en jeu' : 'au menu')) + '</td>'
        + '<td><button class="danger kick" data-name="' + esc(p.name) + '">Exclure</button></td></tr>').join('');
    $('player-count').textContent = '(' + s.players.length + ' joueurs, ' + s.spectators + ' spectateurs)';
    pb.querySelectorAll('.kick').forEach((b) => { b.onclick = () => { if (confirm('Exclure ' + b.dataset.name + ' ?')) act('kick', { name: b.dataset.name, reason: 'exclu par un admin' }); }; });

    const lb = $('live').querySelector('tbody');
    lb.innerHTML = (s.leaderboard?.all ?? []).map((r) => '<tr' + (r.alive ? '' : ' style="opacity:.5"') + '><td>' + r.rank + '</td><td>' + esc(r.name) + '</td><td class="num">' + r.mass + '</td><td class="num">' + r.kills + '</td><td class="num">' + (r.score ?? '—') + '</td></tr>').join('');
}

async function loadGames() {
    let data;
    try { data = await api('games'); } catch { return; }
    const tb = $('games').querySelector('tbody');
    tb.innerHTML = data.games.map((g) => '<tr><td>' + esc(g.id) + '</td><td>' + new Date(g.started_at).toLocaleString('fr-FR') + '</td><td>' + fmt(g.duration_ms) + '</td>'
        + '<td class="num">' + g.player_count + '</td><td>' + esc(g.winner ?? '') + '</td><td>' + esc(g.formula) + '</td>'
        + '<td class="links">' + ['classement.csv', 'snapshots.csv', 'kills.csv', 'n4lan.csv', 'partie.json'].map((f) => '<a href="/api/admin/games/' + encodeURIComponent(g.id) + '/' + f + '">' + f + '</a>').join('') + '</td></tr>').join('')
        || '<tr><td colspan="7" style="opacity:.6">Aucune partie terminée pour l\'instant.</td></tr>';
}

async function loadFailed() {
    let data;
    try { data = await api('failed-logins'); } catch { return; }
    $('failed').querySelector('tbody').innerHTML = data.attempts.map((a) => '<tr><td>' + new Date(a.at).toLocaleString('fr-FR') + '</td><td>' + esc(a.username) + '</td><td>' + esc(a.ip_address) + '</td><td>' + esc(a.via) + '</td></tr>').join('')
        || '<tr><td colspan="4" style="opacity:.6">Aucune.</td></tr>';
}

function tick() {
    if (clock) {
        let remaining = clock.remainingMs;
        if (clock.state === 'running') remaining -= Date.now() - clock.receivedAt;
        $('time').textContent = clock.state === 'lobby' ? fmt(clock.durationMs) : (clock.state === 'ended' ? '0:00' : fmt(remaining));
    }
    requestAnimationFrame(tick);
}
tick();

// Session déjà ouverte ?
api('state').then(showConsole).catch(() => showLogin());
