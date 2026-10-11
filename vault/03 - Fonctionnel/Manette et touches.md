# Manette et touches

## Touches

Quatre actions reconfigurables dans Réglages, comparées sur `event.code` (indépendant de la disposition azerty/qwerty) et sauvegardées dans `localStorage` (`n4agar.keys`) :

| Action | Défaut |
|---|---|
| Split | `Space` |
| Nourrir | `KeyW` (Z sur azerty, comme l'amont) |
| Rappel | `KeyR` |
| Classement complet | `Tab` |

Cliquer sur un bouton de touche, appuyer sur la nouvelle touche (Échap annule). Une touche déjà affectée est libérée. « Réinitialiser » remet les défauts. Les flèches dirigent toujours, Entrée ouvre le chat.

## Manette

Gamepad API, interrogée à chaque frame (`gamepad.js`). Mapping « standard » du navigateur, identique pour Xbox et PlayStation :

| Élément | Index | Action |
|---|---|---|
| Stick gauche | axes 0/1 | direction, intensité proportionnelle au-delà d'une zone morte de 0,18 ; relâcher immobilise |
| A / Croix | 0 | split (et valider dans le menu) |
| B / Rond | 1 | rappel |
| X / Carré | 2 | nourrir |
| Y / Triangle | 3 | rappel |
| Start / Options | 9 | classement complet (et Réglages dans le menu) |
| Croix directionnelle | 12–15 | navigation du menu (répétition toutes les 250 ms) |

Quand le stick est actif, la souris est ignorée (`global.gamepadActive`). Le pseudo se saisit au clavier ; le dernier pseudo est mémorisé. Le navigateur ne voit une manette qu'après un premier appui : l'indication sous les boutons passe au vert à la détection.

## Rappel (se refondre)

Côté serveur (`Player.recall`) : refus si une seule cellule, rappel en cours ou cooldown. Sinon `recallUntil = now + 2,5 s`, `recallReadyAt = now + 8 s`, et le délai naturel de fusion est mis à zéro. Pendant le rappel, `move()` tire chaque cellule de 9 px/tick vers le barycentre et fusionne au contact. Un split annule le rappel.

Le client affiche une barre (verte prête, orange en cooldown, bleue pendant le rappel) et un anneau bleu pointillé autour des cellules concernées, visible par tous : un adversaire voit venir la refonte.
