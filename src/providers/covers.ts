import { coverUrl, type Game } from "../data/games.ts";
import { poolProvider } from "./pool.ts";

// Limite connue : beaucoup de jaquettes affichent le nom du jeu. On l'accepte (pas de masquage).
export const covers = poolProvider<Game & { cover: string }>({
  id: "covers",
  label: "Jeux vidéo : jaquettes",
  load: async () =>
    ((await import("../../data/games.json")).default as Game[]).filter((g): g is Game & { cover: string } => g.cover !== null),
  key: (g) => String(g.id),
  toQuestion: (g, id) => ({
    id,
    theme: "covers",
    prompt: "De quel jeu est cette jaquette ?",
    media: { type: "image", src: coverUrl(g.cover) },
    answers: [{ label: "Jeu", value: g.name }],
  }),
});
