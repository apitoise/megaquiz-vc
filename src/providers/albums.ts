import type { Album } from "../data/albums.ts";
import { poolProvider } from "./pool.ts";

/** « Pochettes d'album » : pochette floutée (son texte n'aide pas), nette à la révélation. Deux jugements. */
export const albums = poolProvider<Album>({
  id: "albums",
  label: "Pochettes d'album",
  load: async () => (await import("../../data/albums.json")).default as Album[],
  key: (a) => a.slug,
  toQuestion: (a, id) => ({
    id,
    theme: "albums",
    prompt: "Quel est cet album, et de qui est-il ?",
    media: { type: "image", src: a.cover, blur: true },
    answers: [
      { label: "Album", value: a.title },
      { label: "Artiste", value: a.artist },
    ],
  }),
});
