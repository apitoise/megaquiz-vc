import type { Artwork, Dish, Landmark, Logo, Person } from "../data/wiki.ts";
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

export const people = poolProvider<Person>({
  id: "people",
  label: "Personnalités",
  load: async () => (await import("../../data/people.json")).default as Person[],
  key: (p) => p.slug,
  // Cinéma, musique, sport, histoire et culture à parts égales, jamais deux fois de suite.
  group: (p) => p.category,
  toQuestion: (p, id) => ({
    id,
    theme: "people",
    prompt: "Qui est-ce ?",
    media: { type: "image", src: p.image },
    answers: [{ label: "Personnalité", value: p.name }],
  }),
});

export const dishes = poolProvider<Dish>({
  id: "dishes",
  label: "Plats du monde",
  load: async () => (await import("../../data/dishes.json")).default as Dish[],
  key: (d) => d.slug,
  // France, Europe, Asie, Amériques, Afrique et Moyen-Orient à parts égales.
  group: (d) => d.region,
  toQuestion: (d, id) => ({
    id,
    theme: "dishes",
    prompt: "Quel est ce plat ?",
    media: { type: "image", src: d.image },
    answers: [{ label: "Plat", value: `${d.name} (${d.country})` }],
  }),
});

/** Logos sans le nom de la marque (relus à l'œil), sur fond clair. */
export const logos = poolProvider<Logo>({
  id: "logos",
  label: "Logos",
  load: async () => (await import("../../data/logos.json")).default as Logo[],
  key: (l) => l.slug,
  // Les applis et services numériques sont majoritaires : à parts égales avec tout le reste (marques, sport, médias).
  group: (l) => (l.category === "tech" ? "tech" : "autres"),
  toQuestion: (l, id) => ({
    id,
    theme: "logos",
    prompt: "À quelle marque ou à quoi appartient ce logo ?",
    media: { type: "image", src: l.image, light: true },
    answers: [{ label: "Logo", value: l.name }],
  }),
});
