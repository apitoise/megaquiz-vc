import type { Artwork, Landmark } from "../data/wiki.ts";
import { poolProvider } from "./pool.ts";

/** Tableaux et sculptures : deux jugements (œuvre, artiste), un seul pour une œuvre anonyme. */
export const art = poolProvider<Artwork>({
  id: "art",
  label: "Art : tableaux et sculptures",
  load: async () => (await import("../../data/art.json")).default as Artwork[],
  key: (a) => a.slug,
  toQuestion: (a, id) => ({
    id,
    theme: "art",
    prompt: a.artist ? "Quelle est cette œuvre, et qui en est l'auteur ?" : "Quelle est cette œuvre ?",
    media: { type: "image", src: a.image },
    answers: a.artist
      ? [
          { label: "Œuvre", value: a.title },
          { label: "Artiste", value: a.artist },
        ]
      : [{ label: "Œuvre", value: a.title }],
  }),
});

export const landmarks = poolProvider<Landmark>({
  id: "landmarks",
  label: "Monuments et lieux",
  load: async () => (await import("../../data/landmarks.json")).default as Landmark[],
  key: (l) => l.slug,
  toQuestion: (l, id) => ({
    id,
    theme: "landmarks",
    prompt: "Quel est ce lieu ?",
    media: { type: "image", src: l.image },
    answers: [{ label: "Lieu", value: `${l.name} (${l.place})` }],
  }),
});
