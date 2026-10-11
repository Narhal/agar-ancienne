// Réglages persistants (localStorage) : touches et options d'affichage.

const KEYS_STORAGE = 'n4agar.keys';
const OPTIONS_STORAGE = 'n4agar.options';
const NAME_STORAGE = 'n4agar.name';
const TOKEN_STORAGE = 'n4agar.token';

export const DEFAULT_KEYS = {
    split: 'Space',
    feed: 'KeyW',
    recall: 'KeyR',
    board: 'Tab',
};

const safeGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch { /* navigation privée */ } };

export function loadKeys() {
    try {
        const saved = JSON.parse(safeGet(KEYS_STORAGE) || '{}');
        return { ...DEFAULT_KEYS, ...saved };
    } catch {
        return { ...DEFAULT_KEYS };
    }
}

export function saveKeys(keys) {
    safeSet(KEYS_STORAGE, JSON.stringify(keys));
}

export function loadOptions() {
    try {
        return JSON.parse(safeGet(OPTIONS_STORAGE) || '{}');
    } catch {
        return {};
    }
}

export function saveOption(name, value) {
    const options = loadOptions();
    options[name] = value;
    safeSet(OPTIONS_STORAGE, JSON.stringify(options));
}

export function loadName() {
    return safeGet(NAME_STORAGE) || '';
}

export function saveName(name) {
    safeSet(NAME_STORAGE, name);
}

// Jeton d'identité du navigateur : permet de reprendre sa cellule après une
// coupure réseau (combiné à l'IP côté serveur).
export function sessionToken() {
    let token = safeGet(TOKEN_STORAGE);
    if (!token) {
        token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
        safeSet(TOKEN_STORAGE, token);
    }
    return token;
}

// Libellé lisible d'un `event.code`.
export function keyLabel(code) {
    if (!code) return '—';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    const names = { Space: 'Espace', Tab: 'Tab', ShiftLeft: 'Maj G', ShiftRight: 'Maj D', ControlLeft: 'Ctrl G', ControlRight: 'Ctrl D', AltLeft: 'Alt', Enter: 'Entrée', Backquote: '²' };
    return names[code] || code;
}
