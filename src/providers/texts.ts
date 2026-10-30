import { poolProvider } from "./pool.ts";

/** Titre en emojis (data/emojis_fr.json, rédigé à la main) : film, série ou animation. */
export interface EmojiTitle {
  id: string;
  category: string;
  emojis: string;
  answer: string;
}

/** Réplique culte (data/quotes_fr.json, rédigé à la main), en VF pour les œuvres étrangères. */
export interface Quote {
  id: string;
  category: string;
  quote: string;
  answer: string;
  /** Qui la prononce (vide si personne en particulier). */
  who: string;
}

interface TextData<T> {
  /** Libellés affichés (« 🎬 Film »…), par identifiant de catégorie. */
  categories: Record<string, string>;
  items: T[];
}

let emojiLabels: Record<string, string> = {};
let quoteLabels: Record<string, string> = {};

export const emojis = poolProvider<EmojiTitle>({
  id: "emojis",
  label: "Films et séries en emojis",
  async load() {
    const data = (await import("../../data/emojis_fr.json")).default as TextData<EmojiTitle>;
    emojiLabels = data.categories;
    return data.items;
  },
  key: (e) => e.id,
  // Films, séries et animation à parts égales, jamais deux fois de suite.
  group: (e) => e.category,
  toQuestion: (e, id) => ({
    id,
    theme: "emojis",
    prompt: e.emojis,
    media: { type: "text", src: `${emojiLabels[e.category] ?? e.category} : quel est ce titre ?` },
    answers: [{ label: "Titre", value: e.answer }],
  }),
});

export const quotes = poolProvider<Quote>({
  id: "quotes",
  label: "Répliques cultes",
  async load() {
    const data = (await import("../../data/quotes_fr.json")).default as TextData<Quote>;
    quoteLabels = data.categories;
    return data.items;
  },
  key: (q) => q.id,
  // Films français, films étrangers, séries, animation et jeux à parts égales.
  group: (q) => q.category,
  toQuestion: (q, id) => ({
    id,
    theme: "quotes",
    prompt: `« ${q.quote} »`,
    media: { type: "text", src: `${quoteLabels[q.category] ?? q.category} : de quelle œuvre vient cette réplique ?` },
    answers: [{ label: "Œuvre", value: q.who ? `${q.answer} (${q.who})` : q.answer }],
  }),
});
