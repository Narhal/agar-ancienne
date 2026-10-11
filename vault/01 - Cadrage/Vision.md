# Vision

Un agar.io qui tient une **soirée de LAN** : on lance une partie de 15 minutes, tout le monde joue, et à la fin il y a un vrai classement de tous les joueurs, pas seulement des dix survivants, avec des chiffres qu'un admin peut relire, exporter et verser dans le classement général de N4Lan.

## Ce que l'amont ne faisait pas

- Pas de partie : le serveur tourne sans début ni fin.
- Top 10 seulement, et un joueur mangé disparaît du classement avec son score.
- Pas de « qui a mangé qui ».
- jQuery depuis Internet : injouable hors ligne.
- Pas de manette, pas de touches configurables, pas de moyen de se refondre après un split.

## Ce que Agar-ancienne vise

- **Lisible pour la salle** : chrono au centre, classement complet sur l'écran commun, vainqueur affiché en grand.
- **Juste** : les snapshots récompensent la régularité, pas le dernier blob ; les kills comptent ; le rappel réduit la part de hasard du split.
- **Exploitable par les admins** : console web, exports CSV ouverts d'un double-clic sous Excel français, CSV prêt pour N4Lan.
- **Sans surprise la veille** : une image Docker, aucune compilation native, aucune ressource distante.
