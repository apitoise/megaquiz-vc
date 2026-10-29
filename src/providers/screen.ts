import { backdropUrl, posterUrl, type ScreenWork } from "../data/screen.ts";
import { randomInt } from "../game/random.ts";
import type { QuestionProvider } from "../types.ts";
import { poolProvider } from "./pool.ts";

interface ScreenTheme {
  id: string;
  label: string;
  prompt: string;
  answerLabel: string;
  load(): Promise<ScreenWork[]>;
  /** Image posée (affiche sans texte, ou image de scène tirée au hasard), ou null si l'œuvre n'en a pas. */
  image(work: ScreenWork): string | null;
}

/** Thème « reconnaître le film ou la série à son image ». À la révélation : l'affiche officielle en vignette. */
function screenProvider(theme: ScreenTheme): QuestionProvider {
  return poolProvider<ScreenWork>({
    id: theme.id,
    label: theme.label,
    load: async () => (await theme.load()).filter((w) => theme.image(w) !== null),
    key: (w) => String(w.id),
    toQuestion: (w, id) => ({
      id,
      theme: theme.id,
      prompt: theme.prompt,
      media: { type: "image", src: theme.image(w)! },
      ...(w.poster ? { revealMedia: { type: "image" as const, src: posterUrl(w.poster) } } : {}),
      answers: [{ label: theme.answerLabel, value: w.name }],
    }),
  });
}

const loadFilms = async () => (await import("../../data/films.json")).default as ScreenWork[];
const loadSeries = async () => (await import("../../data/series.json")).default as ScreenWork[];
const textlessPoster = (w: ScreenWork) => (w.textlessPoster ? posterUrl(w.textlessPoster) : null);
const randomBackdrop = (w: ScreenWork) => (w.backdrops.length ? backdropUrl(w.backdrops[randomInt(w.backdrops.length)]) : null);

export const filmPosters = screenProvider({
  id: "film-posters",
  label: "Films : affiches",
  prompt: "De quel film est cette affiche ?",
  answerLabel: "Film",
  load: loadFilms,
  image: textlessPoster,
});

export const filmImages = screenProvider({
  id: "film-images",
  label: "Films : images",
  prompt: "De quel film est cette image ?",
  answerLabel: "Film",
  load: loadFilms,
  image: randomBackdrop,
});

export const seriesPosters = screenProvider({
  id: "series-posters",
  label: "Séries : affiches",
  prompt: "De quelle série est cette affiche ?",
  answerLabel: "Série",
  load: loadSeries,
  image: textlessPoster,
});

export const seriesImages = screenProvider({
  id: "series-images",
  label: "Séries : images",
  prompt: "De quelle série est cette image ?",
  answerLabel: "Série",
  load: loadSeries,
  image: randomBackdrop,
});
