# MégaQuiz

Quiz local à deux joueurs sur un seul écran. Les réponses se donnent à l'oral ; le jeu affiche la question, lance le timer, révèle la réponse, et vous désignez qui a marqué.

## Lancer

Prérequis : Node.js ≥ 22.18 (le serveur local est en TypeScript exécuté nativement par Node).

```sh
npm install
cp .env.example .env   # identifiants Twitch, nécessaires seulement pour les thèmes jeux vidéo
npm run dev            # http://127.0.0.1:5173
```

`npm run dev` démarre Vite et le serveur proxy local (`127.0.0.1:8787`, jamais exposé sur le réseau).

Autres commandes : `npm test` (Vitest), `npm run typecheck`.

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
