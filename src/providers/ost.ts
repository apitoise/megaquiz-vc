import type { FreshTrack } from "../data/music.ts";
import type { OstGame } from "../data/ost.ts";
import { randomInt, shuffle } from "../game/random.ts";
import { fetchFreshTrack, MAX_START_OFFSET_S } from "./music.ts";
import { poolProvider } from "./pool.ts";

/** Pistes essayées pour un même jeu avant d'abandonner la question (extrait retiré, réseau…). */
const TRACK_ATTEMPTS = 3;

export const ost = poolProvider<OstGame>({
  id: "ost",
  label: "Jeux vidéo : OST",
  load: async () => (await import("../../data/ost.json")).default as OstGame[],
  key: (g) => g.slug,
  async toQuestion(game, id) {
    // Le jeu ne revient qu'une fois par partie ; la piste est tirée au hasard dans son album.
    let fresh: FreshTrack | null = null;
    let lastError: unknown;
    for (const trackId of shuffle(game.tracks).slice(0, TRACK_ATTEMPTS)) {
      try {
        fresh = await fetchFreshTrack(trackId);
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!fresh) throw lastError;
    return {
      id,
      theme: "ost",
      prompt: "De quel jeu vient cette musique ?",
      media: { type: "audio", src: fresh.preview, startAt: randomInt(MAX_START_OFFSET_S + 1) },
      ...(fresh.cover ? { revealMedia: { type: "image" as const, src: fresh.cover } } : {}),
      answers: [{ label: "Jeu", value: game.name }],
    };
  },
});
