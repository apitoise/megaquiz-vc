# MégaQuiz

Quiz local à deux joueurs sur un seul écran. Les réponses se donnent à l'oral ; le jeu affiche la question, lance le timer, révèle la réponse, et vous désignez qui a marqué.

## Lancer

Prérequis : Node.js ≥ 22.18 (le serveur local est en TypeScript exécuté nativement par Node).

```sh
npm install
cp .env.example .env   # identifiants Twitch, nécessaires seulement pour les thèmes jeux vidéo
npm run dev            # http://127.0.0.1:5173
```

`npm run dev` démarre Vite et le serveur proxy local (`127.0.0.1:8787`, jamais exposé sur le réseau). Le thème Musique a besoin de ce serveur (proxy Deezer).

### Sur le réseau local

`npm run dev:lan` rend le jeu accessible aux autres appareils du réseau (télé, tablette, portable) : l'adresse s'affiche au démarrage, par exemple `http://192.168.1.108:5173`. Seul Vite est exposé ; le serveur proxy (et le secret Twitch) reste sur `127.0.0.1`, Vite lui relaie `/api`. Les écritures (classement, relecture des jaquettes) ne sont acceptées que depuis la page du jeu elle-même (même origine), en local comme sur le réseau.

- **Réseau de confiance uniquement** (Wi-Fi maison) : le serveur de développement Vite n'est pas un serveur durci, et tout appareil connecté peut jouer, écrire au classement et utiliser le proxy Deezer.
- Si un pare-feu (`ufw`) est actif : `sudo ufw allow from 192.168.1.0/24 to any port 5173 proto tcp`.
- Réglages, blacklist et historique restent propres à chaque navigateur ; le classement et la relecture des jaquettes sont communs (stockés sur la machine qui fait tourner le jeu).

Autres commandes : `npm test` (Vitest), `npm run typecheck`.

## Données

Les pools stables sont versionnés dans `data/` ; `npm run build-pools` les régénère (réponses HTTP en cache dans `.cache/`). On peut cibler une partie : `npm run build-pools -- shapes`.

| Fichier | Contenu | Source |
|---|---|---|
| `data/capitals_fr.json` | **curé à la main** : noms, « de… », capitales en français ; champ `doubt` pour les cas litigieux | — |
| `data/countries.json` | 193 membres de l'ONU + Vatican et Palestine, avec leur continent | [mledoze/countries](https://github.com/mledoze/countries) + fichier curé |
| `data/shapes.json` | silhouettes SVG pré-projetées | `world-atlas` (Natural Earth 50m), `d3-geo` |
| `data/games.json` | ~440 jeux connus (≥ 400 notes IGDB, jeux principaux et remakes), ids de jaquette et de screenshots | IGDB (token Twitch) |
| `data/films.json`, `data/series.json` | 300 films et 150 séries les plus votés, titre français, affiche **sans texte** et images de scène sans texte | TMDB (`TMDB_READ_TOKEN`) |
| `data/ost_games.json` | **curé à la main** : jeux candidats au thème OST (`match` pour préciser le titre attendu, `album` pour imposer un album Deezer) | — |
| `data/ost.json` / `data/ost_coverage.json` | albums d'OST validés et pistes ; rapport de couverture (ok / douteux / absent) | recherche d'albums Deezer |
| `data/music.json` | ~3 400 tubes en 7 styles (rap, rock, dance, soul, variété, rétro, tubes) | chart + playlists éditoriales Deezer (liste dans `scripts/pools/music.ts`) |
| `data/trivia_fr.json` | **rédigé à la main** : ~240 questions de culture générale en 9 catégories | — |
| `data/ost_films.json`, `data/ost_series.json` | **curés à la main** : films et séries candidats (`match`, `album`, ou `track` pour un générique précis) | — |
| `data/film_music.json`, `data/series_music.json` (+ `_coverage`) | musiques de films et séries validées, rapport de couverture | recherche Deezer |

Films et séries : TMDB n'est appelé que par `npm run build-pools -- films series` (jeton `TMDB_READ_TOKEN` du `.env`, à créer sur themoviedb.org → Paramètres → API). TMDB classe « sans langue » les affiches et images sans texte : le thème affiches n'utilise que celles-là (pas besoin d'anonymisation). Les séries jeunesse, téléréalité, talk-shows, soaps et l'anime sont écartés. En partie, les images viennent directement de `image.tmdb.org`, sans clé ; à la révélation, l'affiche officielle s'affiche en vignette.

Jeux vidéo : IGDB n'est appelé que par `npm run build-pools -- games` (identifiants Twitch du `.env`, token mis en cache et renouvelé dans `server/igdb.ts`). En partie, les images viennent directement de `images.igdb.com`, sans clé. Le seuil est `MIN_RATING_COUNT` dans `scripts/pools/games.ts`. Beaucoup de jaquettes affichent le nom du jeu : défaut accepté.

Tirage équilibré : les capitales alternent les continents, la musique les styles, la culture générale les catégories (un groupe tiré à parts égales, jamais deux fois de suite). Les formes de pays se limitent à l'Europe et aux Amériques (`SHAPE_REGIONS` dans `src/providers/shapes.ts`).

OST (jeux, films, séries) : un album n'est retenu que si son titre est le nom de l'œuvre + une mention d'OST (pas de reprise, ni d'œuvre d'un autre type ; pour les films et séries, pas d'artiste générique type « … Orchestra »). Les séries peuvent viser un générique précis (`track`). Les jeux « douteux » ou « absents » sont exclus ; pour en valider un à la main, ajouter `"album": <id Deezer>` à son entrée dans `data/ost_games.json` puis `npm run build-pools -- ost`.

Musique : l'URL d'extrait Deezer est signée et expire en ~15 min ; elle n'est jamais stockée, le jeu en demande une fraîche au proxy local (`/api/deezer/track/:id`) au moment de précharger la question. Le seuil de popularité est `MIN_RANK` dans `scripts/pools/music.ts`.

Drapeaux : `https://flagcdn.com/w640/{code}.png`, chargés en direct. Le seuil de superficie des silhouettes est `MIN_SHAPE_AREA_KM2` dans `src/providers/shapes.ts`.

## Contrôles

| Action | Touche |
|---|---|
| Révéler | `Espace` |
| Point à Arthur / Marie / personne | `A` / `M` / `N` |
| Musique : les deux points à Arthur / Marie | `Shift+A` / `Shift+M` |
| Pause / reprise | `P` |
| Question cassée (passer et blacklister) | `X` |
| Rejouer l'extrait | `R` |
| Plein écran | `F` |

Chaque action existe aussi en bouton. L'écran de configuration permet aussi de remettre en jeu les questions retirées et d'oublier l'historique des 3 dernières parties.

## Jaquettes anonymisées

Beaucoup de jaquettes affichent le nom du jeu. Un traitement local efface le texte : EasyOCR repère le texte, LaMa reconstitue le décor (GPU recommandé ; ~1 min pour 443 jaquettes sur une RTX 3060 Ti).

```sh
npm run covers:setup       # une fois : environnement Python .venv (PyTorch CUDA + EasyOCR, ~6 Go)
npm run covers:anonymize   # jaquettes → public/covers/ (hors git) ; -- --force pour tout refaire
```

Chaque jaquette est classée **sûre** (le nom du jeu a été lu puis effacé) ou **à vérifier** (nom non repéré, encore lisible, ou grande zone effacée). En partie, les sûres sont posées dans leur version anonymisée ; celles à vérifier attendent d'être validées dans **Configuration → Relire les jaquettes**, qui montre l'originale et la version anonymisée côte à côte. Une jaquette rejetée n'est jamais posée. L'OCR ne lit pas tous les lettrages stylisés : quelques « sûres » gardent un reste de titre, d'où la relecture (onglet « Sûres ») et la touche `X` en partie. À la révélation, la jaquette d'origine s'affiche en vignette. Sans anonymisation lancée, le thème utilise les jaquettes originales.

## Classement

Chaque partie terminée est enregistrée par le serveur local dans `saves/results.json` (hors git, propre à cette machine). Le classement compte, par joueur : parties jouées, victoires, nuls, défaites, points marqués / encaissés et **différence de points cumulée** ; il est trié par victoires, puis différence, puis points marqués. Il s'affiche en fin de partie et via le bouton « Classement » de la configuration, avec l'historique des dernières parties et leur écart.

Les joueurs sont reconnus par leur nom (casse ignorée). Une partie arrêtée avec « Terminer » apparaît dans l'historique mais ne compte pas au classement. Pour repartir de zéro : supprimer `saves/results.json`.

## Robustesse

- La question suivante est préchargée pendant la question en cours ; un média qui ne charge pas (ou un extrait audio qui coupe) est remplacé automatiquement, avec un message discret.
- Un thème qui ne répond plus (réseau, API) est mis de côté 20 s puis retenté ; ses questions passent à d'autres thèmes en attendant. Un thème épuisé est abandonné pour la partie.
- Si plus aucun thème ne répond (connexion perdue), la partie affiche une attente et reprend seule au retour du réseau ; « Terminer » reste disponible.
- Les thèmes audio vérifient au lancement que le serveur local tourne, et sont ignorés sinon (avec la raison).
- Si le timer dépasse 20 s, le départ de l'extrait est avancé pour que l'extrait (30 s) couvre tout le timer.

## Ajouter un thème

Créer un module dans `src/providers/` qui implémente `QuestionProvider` (`src/types.ts`), puis l'ajouter à la liste de `src/providers/index.ts`.
