import { poolProvider } from "./pool.ts";

/** Question de culture générale (data/trivia_fr.json, rédigé à la main). */
export interface TriviaQuestion {
  id: string;
  category: string;
  question: string;
  answer: string;
}

interface TriviaData {
  /** Libellés affichés (« 🔬 Sciences »…), par identifiant de catégorie. */
  categories: Record<string, string>;
  questions: TriviaQuestion[];
}

/** Rythme de la culture générale dans une partie : une question sur TRIVIA_EVERY. */
export const TRIVIA_EVERY = 5;

let labels: Record<string, string> = {};

export const trivia = poolProvider<TriviaQuestion>({
  id: "trivia",
  label: "Culture générale",
  async load() {
    const data = (await import("../../data/trivia_fr.json")).default as TriviaData;
    labels = data.categories;
    return data.questions;
  },
  key: (q) => q.id,
  // Une catégorie tirée à parts égales, jamais deux fois de suite.
  group: (q) => q.category,
  toQuestion: (q, id) => ({
    id,
    theme: "trivia",
    prompt: q.question,
    media: { type: "text", src: labels[q.category] ?? q.category },
    answers: [{ label: "Réponse", value: q.answer }],
  }),
});
