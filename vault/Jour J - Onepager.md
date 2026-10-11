# Agar-ancienne — Onepager jour J

Tout ce qu'il faut pour déployer et lancer le jeu le jour de la LAN. Une page, dans l'ordre.

## 1. Déployer (la veille, sur le serveur Windows avec Docker Desktop)

```bash
git clone https://github.com/Narhal/agar-ancienne.git
cd agar-ancienne
copy .env.example .env
```

Ouvrir `.env` et changer **`ADMIN_PASS`** (le serveur avertit s'il reste à `changez-moi`). Puis :

```bash
docker compose up -d --build
docker compose logs -f
```

Les logs affichent `jeu : http://<ip>:3000/` ; depuis la salle, l'adresse à annoncer est **`http://<ip du serveur>:3002/`** (port 3002 sur l'hôte).

Vérifier depuis un autre PC : `/` joue, `/classement` affiche le chrono, `/admin` accepte le mot de passe. Si Windows demande d'autoriser Docker sur le réseau privé : oui.

## 2. Tester à vide (10 minutes)

Depuis n'importe quel PC avec Node :

```bash
node tools/bots.js 40 http://<ip>:3002
```

Dans `/admin` : Durée **1**, Snapshot **10**, **Lancer la partie**. Au bout d'une minute : écran de fin, une ligne dans l'historique avec les liens d'export, et un dossier `parties/<id>/` sur le serveur. Arrêter les bots (Ctrl+C).

## 3. Préparer la salle

- Écran commun : navigateur en plein écran (F11) sur `http://<ip>:3002/classement`.
- Postes joueurs : `http://<ip>:3002/`, pseudo, Jouer. Manette : brancher, appuyer sur un bouton, l'indication passe au vert.
- Admin qui joue : dans le chat, `-login <mot de passe>`.

## 4. Lancer une partie

| Où | Quoi |
|---|---|
| `/admin` | Durée (min), Snapshot (s), **Lancer la partie** |
| En jeu | `-start 15 60` (15 min, snapshot toutes les 60 s) |

Tout le monde respawn, le chrono part. Les retardataires rejoignent en cours. Défauts conseillés pour 70 joueurs : **15 min, snapshot 60 s**, formule **rangs**.

Pendant la partie : `-pause` / `-resume` (ou les boutons), `-snapshot` pour un snapshot immédiat, `-kick pseudo` pour exclure, « Message à tous » dans la console.

## 5. Fin de partie

Automatique au bout du temps, ou `-stop`. Le classement final s'affiche chez tous et sur l'écran commun (vainqueur en grand). Le monde est gelé jusqu'au prochain lancement : relancer avec `-start` ou le bouton, autant de fois qu'on veut dans la soirée.

## 6. Récupérer les scores

Par partie, sur le serveur dans `parties/<id>/`, ou depuis `/admin` → Historique → liens :

- `n4lan.csv` : à importer tel quel dans N4Lan (Configuration → Import de points). Motif : « Agar-ancienne partie <id> ».
- `classement.csv`, `snapshots.csv`, `kills.csv`, `partie.json` : pour relire, contester, afficher.

## Si ça tourne mal

| Symptôme | Geste |
|---|---|
| Un joueur dit « pseudo déjà pris » | Il est réservé à une autre machine jusqu'au prochain `-start` : autre pseudo, ou `-kick` de l'usurpateur |
| Un joueur a perdu le réseau | Il a 10 s pour revenir avec le même pseudo depuis la même machine, sinon il respawn |
| L'écran commun fige | F5 : il se resynchronise seul |
| Le serveur redémarre | `docker compose up -d` ; les parties terminées sont en base et dans `parties/`, la partie en cours est perdue |
| Changer la formule ou les points | `/admin` → Score → Enregistrer, valable immédiatement, même en cours de partie |

## Après

Sauvegarder `parties/` et la base : `docker compose cp agar-ancienne:/data ./sauvegarde-data`.
