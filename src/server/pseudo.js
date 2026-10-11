// Règles de pseudo (reprises de N4Lan). Le serveur fait foi.

export const LONGUEUR_MIN = 2;
export const LONGUEUR_MAX = 20;

// Forme canonique pour l'unicité : « Kevin », « KEVIN » et « kévin » sont le même joueur.
export function normaliser(pseudo) {
    return String(pseudo)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[\s_-]+/g, '')
        .trim();
}

const AUTORISE = /^[\p{L}\p{N} ._'-]+$/u;
const INTERDITS = ['admin', 'administrateur', 'serveur', 'systeme', 'n4agar', 'null', 'undefined', 'spectateur'];

/** @returns {{ ok: true, pseudo: string, normalise: string } | { ok: false, motif: string }} */
export function validerPseudo(brut) {
    const pseudo = String(brut ?? '').replace(/\s+/g, ' ').trim();
    if (pseudo.length < LONGUEUR_MIN) return { ok: false, motif: 'trop_court' };
    if (pseudo.length > LONGUEUR_MAX) return { ok: false, motif: 'trop_long' };
    if (!AUTORISE.test(pseudo)) return { ok: false, motif: 'caracteres_interdits' };
    const normalise = normaliser(pseudo);
    if (normalise.length < LONGUEUR_MIN) return { ok: false, motif: 'trop_court' };
    if (INTERDITS.includes(normalise)) return { ok: false, motif: 'reserve' };
    return { ok: true, pseudo, normalise };
}

export const MOTIFS = {
    trop_court: 'Pseudo trop court (2 caractères minimum).',
    trop_long: 'Pseudo trop long (20 caractères maximum).',
    caracteres_interdits: 'Lettres, chiffres, espace, point, tiret et apostrophe seulement.',
    reserve: 'Ce pseudo est réservé.',
    deja_pris: 'Ce pseudo est déjà pris par un autre joueur.',
};
