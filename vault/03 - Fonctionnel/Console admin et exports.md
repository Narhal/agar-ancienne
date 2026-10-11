# Console admin et exports

## Deux accès admin

- **Chat** : `-login motdepasse` puis `-start [min] [sec]`, `-stop`, `-pause`, `-resume`, `-snapshot`, `-kick pseudo [raison]`. Pratique pour l'admin qui joue.
- **Page `/admin`** : tout ce qui précède, plus les réglages de score, un message à tous, la liste des connectés avec IP et état, le classement en direct, l'historique des parties avec exports, et les tentatives de connexion échouées.

Les deux passent par le même objet `actions` dans `server.js` : une seule implémentation.

## Sécurité

- Mot de passe `ADMIN_PASS` (environnement), comparé à temps constant, refusé s'il est vide.
- Page : jeton aléatoire 32 octets en cookie `httpOnly SameSite=Strict Path=/`, 12 h, gardé en mémoire (un redémarrage déconnecte tout le monde).
- Échecs : délai exponentiel par IP (2, 4, 8… s, plafonné à 60 s), ligne dans `failed_logins` avec IP et canal (`http` ou `chat`), ligne dans la console serveur.
- Un avertissement au démarrage si `ADMIN_PASS` est resté à sa valeur par défaut.
- Un admin ne peut pas être exclu.

## Exports de fin de partie

Dossier `parties/<id>/` (volume Docker `./parties`), id = `AAAAMMJJ-HHMM-xxxx`.

| Fichier | Colonnes |
|---|---|
| `classement.csv` | rang, pseudo, score, score_snapshots, masse_finale, kills, morts, masse_max, temps_en_vie, temps_connecte |
| `snapshots.csv` | snapshot, temps_de_jeu, horodatage, rang, pseudo, masse |
| `kills.csv` | temps_de_jeu, horodatage, mangeur, mange, masse_absorbee |
| `n4lan.csv` | pseudo, points, motif (`N4Agar partie <id>`) |
| `partie.json` | id, dates, durée, réglages, classement, snapshots, kills |

Dialecte CSV de N4Lan : point-virgule, BOM UTF-8, CRLF, cellules commençant par `=`/`+`/`-`/`@` protégées. `n4lan.csv` s'importe tel quel dans Configuration → Import de points de N4Lan (les pseudos doivent exister côté N4Lan ; les inconnus sont listés par l'aperçu d'import).

Les mêmes fichiers se téléchargent depuis la console (`/api/admin/games/<id>/<fichier>`), générés à la volée depuis la base.

## Base SQLite

`data/n4agar.sqlite` (volume `n4agar-data`) : `games` (résultat JSON complet), `chat_messages` (avec IP et id de partie), `failed_logins`.
