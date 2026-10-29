import type { FreshTrack } from "../data/music.ts";
import type { Soundtrack } from "../data/ost.ts";
import { randomInt, shuffle } from "../game/random.ts";
import type { QuestionProvider } from "../types.ts";
import { checkLocalServer, fetchFreshTrack, MAX_START_OFFSET_S } from "./music.ts";
import { poolProvider } from "./pool.ts";

/** Pistes essayées pour une même œuvre avant d'abandonner la question (extrait retiré, réseau…). */
const TRACK_ATTEMPTS = 3;

interface SoundtrackTheme {
  id: string;
  label: string;
  prompt: string;
  answerLabel: string;
  load(): Promise<Soundtrack[]>;
}

/** Thème « reconnaître l'œuvre à sa musique » : une piste au hasard de l'album, un seul jugement. */
function soundtrackProvider(theme: SoundtrackTheme): QuestionProvider {
  return poolProvider<Soundtrack>({
    id: theme.id,
    label: theme.label,
    async load() {
      await checkLocalServer();
      return theme.load();
    },
    key: (w) => w.slug,
    async toQuestion(work, id) {
      // L'œuvre ne revient qu'une fois par partie ; la piste est tirée au hasard dans son album.
      let fresh: FreshTrack | null = null;
      let lastError: unknown;
      for (const trackId of shuffle(work.tracks).slice(0, TRACK_ATTEMPTS)) {
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
        theme: theme.id,
        prompt: theme.prompt,
        media: { type: "audio", src: fresh.preview, startAt: randomInt(MAX_START_OFFSET_S + 1) },
        ...(fresh.cover ? { revealMedia: { type: "image" as const, src: fresh.cover } } : {}),
        answers: [{ label: theme.answerLabel, value: work.name }],
      };
    },
  });
}

export const ost = soundtrackProvider({
  id: "ost",
  label: "Jeux vidéo : OST",
  prompt: "De quel jeu vient cette musique ?",
  answerLabel: "Jeu",
  load: async () => (await import("../../data/ost.json")).default as Soundtrack[],
});

export const filmMusic = soundtrackProvider({
  id: "film-music",
  label: "Films : musique",
  prompt: "De quel film vient cette musique ?",
  answerLabel: "Film",
  load: async () => (await import("../../data/film_music.json")).default as Soundtrack[],
});

export const seriesMusic = soundtrackProvider({
  id: "series-music",
  label: "Séries : musique",
  prompt: "De quelle série vient cette musique ?",
  answerLabel: "Série",
  load: async () => (await import("../../data/series_music.json")).default as Soundtrack[],
});
