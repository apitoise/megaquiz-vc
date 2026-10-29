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

Autres commandes : `npm test` (Vitest), `npm run typecheck`.

## Données

Les pools stables sont versionnés dans `data/` ; `npm run build-pools` les régénère (réponses HTTP en cache dans `.cache/`). On peut cibler une partie : `npm run build-pools -- shapes`.

| Fichier | Contenu | Source |
|---|---|---|
| `data/capitals_fr.json` | **curé à la main** : noms, « de… », capitales en français ; champ `doubt` pour les cas litigieux | — |
| `data/countries.json` | 193 membres de l'ONU + Vatican et Palestine | [mledoze/countries](https://github.com/mledoze/countries) + fichier curé |
| `data/shapes.json` | silhouettes SVG pré-projetées | `world-atlas` (Natural Earth 50m), `d3-geo` |
| `data/games.json` | ~440 jeux connus (≥ 400 notes IGDB, jeux principaux et remakes), ids de jaquette et de screenshots | IGDB (token Twitch) |
| `data/music.json` | ~2 900 tubes (id Deezer, titre nettoyé, artiste, popularité) | chart + playlists éditoriales Deezer (liste dans `scripts/pools/music.ts`) |

Jeux vidéo : IGDB n'est appelé que par `npm run build-pools -- games` (identifiants Twitch du `.env`, token mis en cache et renouvelé dans `server/igdb.ts`). En partie, les images viennent directement de `images.igdb.com`, sans clé. Le seuil est `MIN_RATING_COUNT` dans `scripts/pools/games.ts`. Beaucoup de jaquettes affichent le nom du jeu : défaut accepté.

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

Chaque action existe aussi en bouton.

## Ajouter un thème

Créer un module dans `src/providers/` qui implémente `QuestionProvider` (`src/types.ts`), puis l'ajouter à la liste de `src/providers/index.ts`.
