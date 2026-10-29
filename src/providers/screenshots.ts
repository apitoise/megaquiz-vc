import { screenshotUrl, type Game } from "../data/games.ts";
import { randomInt } from "../game/random.ts";
import { poolProvider } from "./pool.ts";

/** Un jeu ne revient qu'une fois par partie ; le screenshot est tiré au hasard parmi les siens. */
export const screenshots = poolProvider<Game>({
  id: "screenshots",
  label: "Jeux vidéo : screenshots",
  load: async () => ((await import("../../data/games.json")).default as Game[]).filter((g) => g.screenshots.length > 0),
  key: (g) => String(g.id),
  toQuestion: (g, id) => ({
    id,
    theme: "screenshots",
    prompt: "De quel jeu est cette image ?",
    media: { type: "image", src: screenshotUrl(g.screenshots[randomInt(g.screenshots.length)]) },
    answers: [{ label: "Jeu", value: g.name }],
  }),
});
