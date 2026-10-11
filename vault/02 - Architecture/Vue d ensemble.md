# Vue d'ensemble

## Modules serveur (`src/server/`)

| Fichier | Rôle |
|---|---|
| `server.js` | Express + socket.io, sockets joueurs/spectateurs/écran, boucle de jeu (60 Hz), boucle lente (1 s), envois réseau (40 Hz), actions admin partagées entre HTTP et chat |
| `game.js` | **Cycle de vie d'une partie** et statistiques par pseudo. Ne connaît ni sockets ni carte : reçoit le temps (injectable) et la liste des vivants, rend snapshots et fin |
| `score.js` | Fonctions pures : rang des entrées, fusion des snapshots (trois formules), classement final |
| `admin.js` | Routeur `/api/admin/*` : connexion, sessions, pilotage, historique, exports |
| `db.js` | `node:sqlite` : `games`, `chat_messages`, `failed_logins` |
| `logs.js` | Génération des exports (JSON, CSV, CSV N4Lan) et écriture du dossier de partie |
| `pseudo.js`, `csv.js` | Copiés de N4Lan (normalisation, dialecte CSV français) |
| `config.js` | Valeurs par défaut surchargées par l'environnement |
| `game/` | Moteur porté de l'amont en ESM : `map`, `player` (+ rappel), `food`, `virus`, `massFood`, `entities`, `util` |

## Client (`src/client/`)

Modules ES natifs, sans bundler. `index.html` (jeu), `classement.html` (écran TV, socket `type=board`), `admin.html` (console, HTTP seulement).

| Fichier | Rôle |
|---|---|
| `js/app.js` | Hub : menu, socket, HUD (chrono, top 10, rappel), panneau complet, écran de fin, rendu, battement de cœur |
| `js/canvas.js` | Souris, tactile, clavier (touches configurables par `event.code`), cible manette |
| `js/gamepad.js` | Gamepad API, mapping standard, menu |
| `js/settings.js` | localStorage : touches, options, pseudo, jeton de reconnexion |
| `js/render.js` | Dessin (anneau de rappel ajouté) |
| `js/chat-client.js` | Chat et commandes, dont les commandes admin |
| `js/board.js`, `js/admin.js` | Pages écran et console |

## Événements socket

Client → serveur : `join {name, screenWidth, screenHeight, token}`, `0` (cible, 20 Hz), `1` nourrir, `2` split, `3` rappel, `playerChat`, `pass` (login admin), `admin {cmd, args}`, `pingcheck`, `windowResized`.

Serveur → client : `welcome`, `gameStarted` (même charge utile, force l'entrée en jeu), `joinError`, `serverTellPlayerMove` (monde visible), `leaderboard {players, state, top, all}` et `clock` chaque seconde à tous, `snapshotTaken`, `gameEnded {ranking…}`, `recallResult`, `RIP {killer}`, `playerDied {name, killer}`, `playerJoin`, `playerDisconnect`, `serverMSG`, `serverSendPlayerChat`, `kick`.

Ce qui part vers les clients passe par `GameMap.projectPlayer` : ni IP ni jeton n'y figurent.

## API admin

`POST /api/admin/login|logout`, `GET state`, `POST start|stop|pause|resume|snapshot|settings|kick|message`, `GET games`, `GET games/:id`, `GET games/:id/<fichier>`, `GET failed-logins`. Cookie `agar-ancienne_admin`, `httpOnly`, `SameSite=Strict`.

## Déploiement

`docker compose up -d --build` : image `node:24-alpine`, port 3002 → 3000, volume `./parties` (exports) et volume nommé `agar-ancienne-data` (SQLite). Toute la configuration passe par l'environnement (`.env.example`).
