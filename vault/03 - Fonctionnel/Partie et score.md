# Partie et score

## Cycle de vie

```
lobby ──(-start)──▶ running ──(temps écoulé / -stop)──▶ ended ──(-start)──▶ running …
                      │ ▲
               (-pause)│ │(-resume)
                      ▼ │
                     paused
```

- **lobby** : échauffement libre. On mange, on split, rien n'est compté. Le HUD affiche la durée prévue et « en attente du lancement ».
- **-start [min] [sec]** : monde réinitialisé, tous les joueurs connectés respawnent (événement `gameStarted`, même ceux au menu), réservations de pseudos remises à zéro, statistiques vides.
- **running** : à chaque seconde, la boucle lente appelle `game.tick(vivants)` qui prend les snapshots dus et détecte la fin.
- **paused** : plus de mouvement, plus de collisions, cibles et actions ignorées ; le temps restant et le prochain snapshot sont décalés d'autant à la reprise.
- **ended** : monde gelé, classement final envoyé à tous (`gameEnded`), exports écrits, partie enregistrée en base. Les joueurs voient l'écran de fin ; un `-start` les relance.

## Statistiques (par pseudo normalisé)

`kills`, `deaths`, `maxMass`, `aliveMs`, `connectedMs`, `finalMass`. Un joueur qui meurt et respawn garde la même ligne. Les durées excluent les pauses.

## Snapshots

`{ index, at, elapsedMs, entries: [{ name, mass, rank }] }`, entrées triées par masse décroissante, **sans les morts ni les déconnectés** (ils comptent 0). Pris à l'intervalle réglé, ou à la demande (`-snapshot`, bouton console). Diffusés en `snapshotTaken` (toast « Snapshot N »).

## Formules

| Formule | Points d'un snapshot pour un joueur | Total |
|---|---|---|
| `somme` | sa masse | somme |
| `moyenne` | sa masse | somme ÷ nombre de snapshots (absences comprises) |
| `rangs` | `RANK_POINTS[rang − 1]` (0 au-delà) | somme |

Score final : `round(w_s × snapshots + w_m × masseFinale + kill × kills)`. Départage : masse finale, puis kills, puis pseudo.

Défauts : `rangs`, barème F1 `25,18,15,12,10,8,6,4,2,1`, `w_s = 1`, `w_m = 1`, `kill = 50`.

## Réglages

Depuis la console (formule, pondérations, barème, durée, intervalle) ou l'environnement. Un changement de formule en cours de partie s'applique au classement provisoire et au final : les snapshots stockent les masses et rangs, pas les points.

## Exports

Voir [[Console admin et exports]].
