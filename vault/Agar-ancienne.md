# Agar-ancienne — agar.io pour la LAN

Fork de [owenashurst/agar.io-clone](https://github.com/owenashurst/agar.io-clone) (MIT) pour le week-end de LAN (~70 joueurs, hors ligne, Docker sur le serveur Windows). Projet voisin de N4Lan et N4Quiz (`../n4lan`, `../n4quiz`). Démarré le 2026-10-11.

Ce qu'il ajoute à l'amont : parties chronométrées lancées par un admin, classement complet, snapshots fusionnés en score global, logs et exports de fin de partie (dont un CSV pour N4Lan), manette, touche « se refondre », console admin, reconnexion, écran TV.

## Carte du vault

### Cadrage
- [[Vision]] — le quoi et le pourquoi
- [[Decisions]] — décisions structurantes numérotées D1…
- [[Questions ouvertes]] — Q1–Q18 posées le 2026-10-11, toutes tranchées par Lionel

### Architecture
- [[Vue d ensemble]] — modules, événements socket, API admin, déploiement

### Fonctionnel
- [[Partie et score]] — cycle de vie, snapshots, formules, exports
- [[Classement]] — HUD, panneau complet, écran TV
- [[Manette et touches]] — Gamepad API, touches configurables, rappel
- [[Console admin et exports]]

### Suivi
- [[Roadmap]] — livré / reste à faire
- [[Check-list jour J]]
- [[05 - Journal/2026-10-11|Journal du 2026-10-11]]

## En une phrase

> Le serveur fait foi sur tout : positions, fusions, temps, snapshots, score. Le client rend et envoie sa cible ; l'admin lance et arrête, et chaque partie laisse un dossier d'exports qu'on peut relire le lendemain.

## Conventions de travail

- Code et commentaires en **anglais** pour rester lisible face à l'amont (D4), interface, vault et messages en **français**.
- Toute décision structurante va dans [[Decisions]] avec un numéro et une raison.
- Chaque session ouvre une note datée dans `05 - Journal/`.
- Python n'est pas installé sur le poste : retouches via `sed`/`perl` ou l'outil d'édition.
- Au début d'une session : lire cette page, le dernier journal et [[Roadmap]]. Ne pas relire tout le vault.
