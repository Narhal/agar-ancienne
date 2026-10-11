# Roadmap

## Livré le 2026-10-11

- [x] Fork en ESM, Node 24, SQLite intégré, sans bundler ni CDN, Dockerfile et compose
- [x] Partie chronométrée : lobby, start, pause, reprise, stop, fin automatique
- [x] Classement complet : HUD top 10, panneau Tab, écran `/classement`, écran de fin
- [x] Snapshots à intervalle réglable, trois formules, pondérations, kills valorisés
- [x] Logs admin : JSON, CSV (classement, snapshots, kills), CSV N4Lan, SQLite, téléchargement depuis la console
- [x] Console `/admin` avec mot de passe, anti-brute-force, historique, exclusion, message
- [x] Manette (Xbox / PlayStation), menu à la manette
- [x] Touches configurables, touche de rappel, rappel serveur avec cooldown et anneau
- [x] Pseudos uniques réservés à l'IP, suivi des kills, reconnexion 10 s, chrono avec bips, battement de cœur robuste
- [x] 25 tests, bots de test, README, vault

## À faire

- [ ] Essai avec une vraie manette (le mapping standard est documenté mais n'a été testé qu'en lecture de code)
- [ ] Essai sur le serveur Windows de la salle avec 30 à 70 bots (`node tools/bots.js 70 http://ip:3002`)
- [ ] Décider : dépôt public ? (Q20)
- [ ] Juger en partie réelle : bonus de masse pour les retardataires (Q21), coût de masse du rappel (Q22)
- [ ] Idées non demandées : son à la mort et au kill, mode équipes, limite de spectateurs, thème visuel N4 (synthwave) au lieu du blanc de l'amont
