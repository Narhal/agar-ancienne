# Classement

Trois vues du même message `leaderboard`, envoyé à tous chaque seconde :

```
{ players, state, top: [{id, name, mass}] (10), all: [{rank, id, name, mass, kills, score, alive}] }
```

- En `lobby`, `all` est trié par masse et `score` vaut `null` (« score non compté »).
- En `running`/`paused`, `all` est le **classement provisoire** calculé exactement comme le final avec les masses actuelles ; les morts y figurent avec `alive: false` et leur masse à 0.
- En `ended`, `all` est le classement final figé.

## Dans le jeu

- **HUD** en haut à droite : top 10 par masse, soi en rouge, nombre de joueurs et rappel de la touche.
- **Panneau complet** (Tab, ou Start à la manette) : tableau rang / joueur / masse / kills / score, morts grisés.
- **Écran de fin** : tableau complet avec score, détail snapshots, masse finale, kills, morts, masse max ; vainqueur en doré ; bouton Fermer pour revoir le monde gelé.

## Écran commun `/classement`

Socket `type=board` : ne reçoit que `leaderboard`, `clock`, `gameEnded`. Chrono géant, grille sur deux colonnes, podium coloré, overlay « Vainqueur » à la fin, compte à rebours rouge sur les 10 dernières secondes. Pensé pour un vidéoprojecteur en 1080p.

## Console admin

Classement en direct dans `/admin`, même source.
