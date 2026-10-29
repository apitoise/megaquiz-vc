import { poolProvider } from "./pool.ts";

/** Résumé d'œuvre (data/summaries_fr.json, rédigé à la main) : livre, film, série ou jeu vidéo. */
export interface Summary {
  id: string;
  category: string;
  summary: string;
  answer: string;
}

interface SummaryData {
  /** Libellés affichés (« 📖 Livre »…), par identifiant de catégorie. */
  categories: Record<string, string>;
  items: Summary[];
}

let labels: Record<string, string> = {};

export const summaries = poolProvider<Summary>({
  id: "summaries",
  label: "Résumés d'œuvres",
  async load() {
    const data = (await import("../../data/summaries_fr.json")).default as SummaryData;
    labels = data.categories;
    return data.items;
  },
  key: (s) => s.id,
  // Livres, films, séries et jeux à parts égales, jamais deux fois de suite le même type.
  group: (s) => s.category,
  toQuestion: (s, id) => ({
    id,
    theme: "summaries",
    prompt: s.summary,
    media: { type: "text", src: `${labels[s.category] ?? s.category} : de quelle œuvre s'agit-il ?` },
    answers: [{ label: "Œuvre", value: s.answer }],
  }),
});
