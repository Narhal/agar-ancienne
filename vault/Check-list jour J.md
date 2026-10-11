# Check-list jour J

## La veille, sur le serveur de la salle

- [ ] `git pull`, `.env` avec un vrai `ADMIN_PASS` (le serveur avertit s'il est resté à `changez-moi`)
- [ ] `docker compose up -d --build`, puis `docker compose logs -f` : deux lignes « jeu : http://… » avec l'IP de la salle
- [ ] Depuis une autre machine : `http://ip:3002/` joue, `/classement` affiche, `/admin` accepte le mot de passe
- [ ] `node tools/bots.js 40 http://ip:3002` depuis un portable : 40 joueurs dans le classement complet, pas de saccade
- [ ] Une partie courte de bout en bout (`-start 1 10`) : écran de fin, dossier dans `parties/`, `n4lan.csv` lisible
- [ ] Tester le `n4lan.csv` dans l'aperçu d'import de N4Lan avec quelques pseudos existants
- [ ] Brancher une manette sur un poste joueur : appui sur un bouton, l'indication passe au vert, stick, split, rappel
- [ ] Écran commun en plein écran (F11) sur `/classement`

## Pendant la soirée

- Durée et intervalle se règlent à chaque `-start` ; 15 min et 60 s sont de bons défauts pour 70 joueurs.
- Les retardataires rejoignent en cours de partie ; un pseudo déjà pris est refusé.
- Un joueur qui perd le réseau a 10 s pour revenir avec le même pseudo depuis la même machine.
- `-pause` si l'écran commun ou le réseau tombe ; `-stop` termine proprement et exporte.
- Les exports sont dans `./parties/<id>/` sur l'hôte, et téléchargeables depuis `/admin`.

## Après

- Importer `n4lan.csv` de chaque partie dans N4Lan (points, motif « N4Agar partie <id> »).
- Sauvegarder `parties/` et le volume `n4agar-data` (`docker compose cp n4agar:/data ./sauvegarde-data`).
