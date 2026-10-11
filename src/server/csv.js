// Generation de CSV.
//
// Deux choix qui n'ont l'air de rien et qui decident si le fichier s'ouvre
// correctement d'un double-clic sur une machine francaise :
//
//   - le separateur est le POINT-VIRGULE. Excel en configuration francaise
//     attend celui-la ; avec une virgule, tout atterrit dans la colonne A.
//   - le fichier commence par une marque d'ordre des octets (BOM) UTF-8.
//     Sans elle, Excel lit du Latin-1 et « Némésis » devient « NÃ©mÃ©sis ».
//
// LibreOffice s'accommode des deux ; Excel, non. On optimise donc pour le
// logiciel le plus susceptible d'etre ouvert un dimanche matin.

export const BOM = '\uFEFF'
const SEPARATEUR = ';'

/**
 * Une cellule.
 *
 * Le guillemet double est le caractere d'echappement du format, et il
 * s'echappe lui-meme en le doublant. Un champ contenant le separateur, un
 * guillemet ou un saut de ligne doit etre entoure de guillemets.
 */
export function cellule(valeur) {
  if (valeur === null || valeur === undefined) return ''
  if (valeur instanceof Date) return valeur.toISOString()

  const texte = String(valeur)
  if (texte === '') return ''

  // Une cellule commencant par =, +, - ou @ est interpretee comme une formule
  // par Excel. Un pseudo comme « =cmd » deviendrait alors une tentative
  // d'execution : on prefixe d'une apostrophe, qui force le texte.
  const dangereuse = /^[=+\-@\t\r]/.test(texte)
  const aProteger = dangereuse || texte.includes(SEPARATEUR) ||
    texte.includes('"') || /[\n\r]/.test(texte)

  const contenu = dangereuse ? `'${texte}` : texte
  return aProteger ? `"${contenu.replace(/"/g, '""')}"` : contenu
}

export function ligne(valeurs) {
  return valeurs.map(cellule).join(SEPARATEUR)
}

/**
 * @param {string[]} entetes
 * @param {Array<Array<unknown>>} lignes
 */
export function versCsv(entetes, lignes) {
  // Fins de ligne CRLF : c'est ce que prescrit le format, et ce qu'attendent
  // les tableurs sous Windows.
  return BOM + [ligne(entetes), ...lignes.map(ligne)].join('\r\n') + '\r\n'
}

/**
 * Lecture d'un CSV au meme dialecte (point-virgule, guillemets doubles,
 * BOM tolere). Rend un tableau de lignes, chaque ligne un tableau de
 * cellules. Un fichier Excel « enregistre sous CSV » en francais passe tel
 * quel ; une virgule comme separateur est acceptee si aucun point-virgule
 * n'apparait sur la premiere ligne.
 */
export function analyserCsv(texte) {
  const source = String(texte ?? '').replace(/^﻿/, '')
  const premiereLigne = source.split(/\r?\n/)[0] ?? ''
  const separateur = premiereLigne.includes(SEPARATEUR) ? SEPARATEUR : ','
  const lignes = []
  let ligne = []
  let cellule = ''
  let entreGuillemets = false
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (entreGuillemets) {
      if (c === '"' && source[i + 1] === '"') { cellule += '"'; i++ }
      else if (c === '"') entreGuillemets = false
      else cellule += c
      continue
    }
    if (c === '"') { entreGuillemets = true; continue }
    if (c === separateur) { ligne.push(cellule); cellule = ''; continue }
    if (c === '\r') continue
    if (c === '\n') { ligne.push(cellule); lignes.push(ligne); ligne = []; cellule = ''; continue }
    cellule += c
  }
  if (cellule !== '' || ligne.length > 0) { ligne.push(cellule); lignes.push(ligne) }
  // L'apostrophe de neutralisation (cf. cellule()) est retiree a la lecture.
  return lignes
    .map((l) => l.map((v) => (/^'[=+\-@]/.test(v) ? v.slice(1) : v)))
    .filter((l) => l.some((v) => v.trim() !== ''))
}

/** Nom de fichier sur : ni accents, ni caracteres interdits sous Windows. */
export function nomDeFichier(base, extension) {
  const propre = String(base)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `${propre || 'export'}.${extension}`
}
