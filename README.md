# N4Agar

Clone d'agar.io taillé pour une LAN party : parties chronométrées lancées par un admin, classement complet de tous les joueurs, snapshots réguliers fusionnés en score final, logs et exports de fin de partie, manette, touche « se refondre ». Hors ligne, un seul conteneur Docker, aucune dépendance Internet à l'exécution.

Dérivé de [owenashurst/agar.io-clone](https://github.com/owenashurst/agar.io-clone) (MIT). La conception vit dans le vault Obsidian `vault/` (point d'entrée `vault/N4Agar.md`).

## Trois pages

| Route | Pour qui |
|---|---|
| `/` | Les joueurs (et les spectateurs) |
| `/classement` | L'écran commun : classement complet, chrono, vainqueur |
| `/admin` | La console d'administration (mot de passe) |

## Démarrage

### Docker (serveur de la LAN)

```bash
cp .env.example .env
```

Éditez `ADMIN_PASS` dans `.env`, puis :

```bash
docker compose up -d --build
```

Le jeu est sur `http://<ip du serveur>:3002/`. Les exports de fin de partie arrivent dans `./parties/`.

### En local (développement)

```bash
npm install
```

```bash
npm start
```

Le serveur affiche au démarrage les URL du réseau local. Variables d'environnement : voir `.env.example` (chargez-les avec `node --env-file=.env src/server/server.js` ou via Docker).

## Déroulé d'une partie

1. Les joueurs se connectent : c'est l'**échauffement**, on joue librement, rien n'est compté.
2. Un admin lance la partie depuis `/admin` ou en jeu avec `-login motdepasse` puis `-start [minutes] [secondes entre snapshots]`. Tout le monde respawn, le chrono démarre.
3. À chaque intervalle, un **snapshot** du classement est pris. Un joueur mort à ce moment compte 0.
4. À la fin du temps (ou sur `-stop`), le serveur calcule le **score final**, l'affiche à tous, l'exporte et attend le prochain `-start`.

Les joueurs qui arrivent en cours de partie jouent tout de suite. Les pseudos sont uniques et réservés à la machine qui les a pris jusqu'à la partie suivante.

### Score

```
score = SNAPSHOT_WEIGHT × score des snapshots
      + FINAL_MASS_WEIGHT × masse finale
      + KILL_VALUE × kills
```

Trois formules pour fusionner les snapshots (`SCORE_FORMULA`, modifiable aussi depuis la console) :

| Formule | Score des snapshots |
|---|---|
| `rangs` (défaut) | Points par rang à chaque snapshot (`RANK_POINTS`, F1 par défaut) : récompense la régularité |
| `somme` | Somme des masses à chaque snapshot |
| `moyenne` | Moyenne des masses sur tous les snapshots |

### Commandes en jeu

Dans le chat : `-help`, `-ping`, `-dark`, `-mass`, `-border`, `-continuity`, `-roundfood`, `-login mdp`. Pour les admins : `-start [min] [snapSec]`, `-stop`, `-pause`, `-resume`, `-snapshot`, `-kick pseudo [raison]`.

### Touches et manette

| Action | Clavier (par défaut) | Manette |
|---|---|---|
| Diriger | Souris ou flèches | Stick gauche (centre = immobile) |
| Split | Espace | A / Croix |
| Nourrir | W | X / Carré |
| Rappel (se refondre) | R | B / Rond ou Y / Triangle |
| Classement complet | Tab | Start / Options |

Les touches se changent dans Réglages (sauvegardées dans le navigateur). Le menu se navigue à la croix directionnelle, A pour valider.

Le **rappel** attire vos cellules vers leur centre pendant 2,5 s et les laisse fusionner au contact, sans attendre les 15 s habituelles. Cooldown de 8 s. Un anneau bleu le signale aux autres joueurs.

## Console admin et exports

`/admin` : lancer, pause, reprise, snapshot manuel, arrêt, réglages de score, message à tous, exclusion, joueurs connectés avec IP, classement en direct, historique des parties, tentatives de connexion échouées.

Chaque partie terminée produit dans `parties/<id>/` :

| Fichier | Contenu |
|---|---|
| `classement.csv` | Rang, score, détail snapshots / masse finale / kills, morts, masse max, temps en vie, temps connecté |
| `snapshots.csv` | Chaque snapshot, ligne par joueur |
| `kills.csv` | Qui a mangé qui, quand, avec quelle masse |
| `n4lan.csv` | `pseudo;points;motif`, importable tel quel dans N4Lan |
| `partie.json` | Tout ce qui précède, brut |

L'historique est aussi en SQLite (`data/n4agar.sqlite`) et téléchargeable depuis la console.

## Outils

```bash
node tools/bots.js 30
```

Lance 30 joueurs automatiques contre le serveur local (ou une URL en second argument) pour tester le classement, les snapshots et la charge.

## Tests

```bash
npm test
```

Score (trois formules, pondérations), cycle de partie (snapshots, pause, fin, joueur arrivé en cours), rappel, pseudos, CSV, mot de passe.

## Différences avec l'amont

- Serveur en ESM, Node 22+, SQLite intégré (`node:sqlite`) : plus de gulp, webpack, babel ni module natif à compiler.
- Plus de jQuery ni de CDN : tout est servi par le conteneur.
- Battement de cœur indépendant du rendu : un onglet en arrière-plan ne fait plus exclure le joueur.
- Reconnexion : 10 s pour récupérer sa cellule après une coupure.
- Suivi des kills, interface en français.

## Licence

MIT, comme l'amont. Voir `LICENSE`.
