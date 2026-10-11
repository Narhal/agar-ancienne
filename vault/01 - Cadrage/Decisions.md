# Décisions

Décisions prises le 2026-10-11 avec Lionel (réponses aux [[Questions ouvertes]]) et par l'architecte pendant la construction.

| # | Sujet | Décision | Raison |
|---|---|---|---|
| D1 | Origine | Fork de owenashurst/agar.io-clone dans un **nouveau dépôt** `Narhal/agar-ancienne`, pas un fork GitHub | Liberté sur le README et la structure (Q17) ; l'amont est inactif |
| D2 | Hébergement | **Docker sur le serveur LAN uniquement**, pas de github.io | Le jeu a besoin d'un serveur Node + WebSocket ; GitHub Pages ne sert que du statique |
| D3 | Stack | Node ESM ≥ 22, Express 4, socket.io 4, `sat`. **SQLite via `node:sqlite`**, pas de module natif. **Pas de bundler** : le client est servi en modules ES natifs | Un `npm ci` sans compilation, une image Alpine légère, rien à builder la veille ; gulp 4 et sqlite3 natif étaient les deux points fragiles de l'amont |
| D4 | Langue | Code et commentaires en **anglais** (continuité avec l'amont), interface, messages, vault et exports en **français** | Q18 |
| D5 | Hors ligne | **Zéro CDN** : jQuery retiré (deux handlers), socket.io client servi par le serveur | L'amont chargeait jQuery depuis Internet : bouton Play mort en LAN sans accès |
| D6 | Cycle de partie | États `lobby` → `running` → `paused` → `ended`. Le lobby est un **échauffement libre non compté**. La fin **gèle** le monde et attend un `-start` admin | Q1–Q3 : l'admin lance par commande, attente après la fin, les retardataires jouent tout de suite |
| D7 | Snapshots | Intervalle réglable (config, console, `-start min sec`). Un joueur **mort ou déconnecté au moment du snapshot compte 0** (absent du snapshot) | Q9 |
| D8 | Score | `score = w_s × snapshots + w_m × masse finale + kill × kills`. Trois formules de fusion sélectionnables : `somme`, `moyenne`, `rangs` (barème F1 par défaut). Réglages modifiables même en cours de partie | Q7, Q8 : les trois codées, kills valorisés, pondérations exposées |
| D9 | Identité | Pseudo **unique par partie** (normalisé : casse, accents, espaces ignorés), **réservé à l'IP** qui l'a pris jusqu'au prochain `-start`. Jeu indépendant de N4Lan, export CSV compatible avec son import de points | Q4, Q5, Q11 |
| D10 | Statistiques | Suivi par pseudo normalisé, indépendant du socket : kills, morts, masse max, temps en vie, temps connecté, masse finale. Le TODO « qui a mangé qui » de l'amont est implémenté | Q10 : tout ce qui était proposé |
| D11 | Exports | Un dossier `parties/<id>/` par partie : `partie.json`, `classement.csv`, `snapshots.csv`, `kills.csv`, `n4lan.csv` (`pseudo;points;motif`). Même dialecte CSV que N4Lan (point-virgule, BOM, neutralisation des formules). Historique en SQLite, téléchargeable depuis la console | Q11 |
| D12 | Console admin | Page `/admin` : mot de passe en cookie `httpOnly SameSite=Strict`, session mémoire 12 h, comparaison à temps constant, ralentissement exponentiel par IP, échecs journalisés. Les commandes chat restent (`-login`, `-start`…) | Q12 : la page plutôt que le chat limité |
| D13 | Rappel | **Rappel** et non fusion instantanée : 2,5 s d'attraction vers le barycentre, fusion au contact, cooldown 8 s, anneau visible par tous, un split l'annule. Touche R par défaut | Q15 : équitable et lisible, réglable par env |
| D14 | Manette | Gamepad API, mapping « standard » commun Xbox/PlayStation. Stick gauche proportionnel (centre = immobile), A split, X nourrir, B/Y rappel, Start classement, croix + A dans le menu | Q13, Q14 |
| D15 | Touches | Quatre actions reconfigurables (`event.code`), sauvegardées en `localStorage`, écran dans Réglages | Q16 |
| D16 | Classement | Top 10 dans le HUD, **panneau complet** à bascule (Tab), page `/classement` pour l'écran commun. Envoyé à tous chaque seconde (70 entrées, négligeable) | Q6 |
| D17 | Battement de cœur | Envoyé par `setInterval`, plus par `requestAnimationFrame` | Trouvé en test : un onglet en arrière-plan n'anime plus et l'amont excluait le joueur après 5 s |
| D18 | Reconnexion | 10 s de grâce : la cellule reste en jeu, un `join` du même pseudo depuis la même IP ou le même jeton navigateur la reprend | Amélioration acceptée (Q19) |
| D19 | Dépôt | GitHub **privé** par défaut, comme N4Lan ; à passer en public si Lionel le souhaite | Le mot de passe admin est dans `.env`, jamais commité, mais la prudence ne coûte rien |
| D20 | Vault | Documentation de conception dans `vault/`, structure héritée de N4Lan | Demande de Lionel |
