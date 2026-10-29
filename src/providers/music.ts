import type { FreshTrack, Track } from "../data/music.ts";
import { randomInt } from "../game/random.ts";
import { poolProvider } from "./pool.ts";

/** L'extrait Deezer dure 30 s : départ entre 0 et 10 s pour éviter l'intro et tenir dans un timer de 20 s. */
export const MAX_START_OFFSET_S = 10;

/** URL d'extrait fraîche via le proxy local (l'URL signée expire en ~15 min, on ne la stocke jamais). */
export async function fetchFreshTrack(id: number): Promise<FreshTrack> {
  const res = await fetch(`/api/deezer/track/${id}`);
  if (!res.ok) throw new Error(`Morceau ${id} indisponible (${res.status})`);
  return (await res.json()) as FreshTrack;
}

export const music = poolProvider<Track>({
  id: "music",
  label: "Musique",
  // ~250 Ko : chargé seulement si le thème est coché.
  load: async () => (await import("../../data/music.json")).default as Track[],
  key: (t) => String(t.id),
  async toQuestion(track, id) {
    const fresh = await fetchFreshTrack(track.id);
    return {
      id,
      theme: "music",
      prompt: "Quel est ce morceau ?",
      media: { type: "audio", src: fresh.preview, startAt: randomInt(MAX_START_OFFSET_S + 1) },
      ...(fresh.cover ? { revealMedia: { type: "image" as const, src: fresh.cover } } : {}),
      answers: [
        { label: "Titre", value: track.title },
        { label: "Artiste", value: track.artist },
      ],
    };
  },
});
