import type { PriceQuestion } from "../data/juste-prix.ts";
import { poolProvider } from "./pool.ts";

const CATEGORY_LABELS: Record<string, string> = {
  prix: "💶 Le juste prix : le plus proche gagne",
  chiffres: "📏 Estimation : le plus proche gagne",
  habitants: "🏙️ Estimation : le plus proche gagne",
};

/** « Le juste prix » : chacun annonce un chiffre, le plus proche marque (ou « Les deux » en cas d'égalité). */
export const justePrix = poolProvider<PriceQuestion>({
  id: "juste-prix",
  label: "Le juste prix",
  load: async () => (await import("../../data/juste_prix.json")).default as PriceQuestion[],
  key: (q) => q.id,
  // Prix, chiffres et populations à parts égales, jamais deux fois de suite la même famille.
  group: (q) => q.category,
  toQuestion: (q, id) => ({
    id,
    theme: "juste-prix",
    prompt: q.question,
    media: q.image ? { type: "image", src: q.image } : { type: "text", src: CATEGORY_LABELS[q.category] ?? CATEGORY_LABELS.chiffres },
    answers: [{ label: "Réponse", value: q.answer }],
  }),
});
