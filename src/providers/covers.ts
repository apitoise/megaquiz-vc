import { anonymizedCoverUrl, coverChoice, type CoverDecision, type CoverManifest, type CoverReviews } from "../data/covers.ts";
import { coverUrl, type Game } from "../data/games.ts";
import { poolProvider, workSubject } from "./pool.ts";

type CoverGame = Game & { cover: string; src: string };

/** Manifeste des jaquettes anonymisées, ou null si l'anonymisation n'a jamais été lancée. */
export async function loadCoverManifest(): Promise<CoverManifest | null> {
  try {
    const res = await fetch("/covers/manifest.json");
    // Vite renvoie index.html (200) pour un fichier absent : on vérifie le type.
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) return null;
    return (await res.json()) as CoverManifest;
  } catch {
    return null;
  }
}

export async function loadCoverReviews(): Promise<CoverReviews> {
  try {
    const res = await fetch("/api/covers/review");
    return res.ok ? ((await res.json()) as CoverReviews) : {};
  } catch {
    return {};
  }
}

export async function saveCoverReview(imageId: string, decision: CoverDecision | null): Promise<CoverReviews> {
  const res = await fetch("/api/covers/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageId, decision }),
  });
  if (!res.ok) throw new Error(`Décision non enregistrée (${res.status})`);
  return (await res.json()) as CoverReviews;
}

// Les jaquettes affichent souvent le nom du jeu : on pose la version anonymisée (texte effacé par
// scripts/covers/anonymize.py). Celles « à vérifier » attendent d'être validées dans la relecture.
export const covers = poolProvider<CoverGame>({
  id: "covers",
  label: "Jeux vidéo : jaquettes",
  async load() {
    const [games, manifest, reviews] = await Promise.all([
      import("../../data/games.json").then((m) => m.default as Game[]),
      loadCoverManifest(),
      loadCoverReviews(),
    ]);
    return games.flatMap((g) => {
      if (!g.cover) return [];
      const choice = coverChoice(g.cover, manifest, reviews);
      if (!choice) return [];
      return [{ ...g, cover: g.cover, src: choice.kind === "anonymized" ? anonymizedCoverUrl(g.cover) : coverUrl(g.cover) }];
    });
  },
  key: (g) => String(g.id),
  subject: (g) => workSubject("game", g.name),
  toQuestion: (g, id) => ({
    id,
    theme: "covers",
    prompt: "De quel jeu est cette jaquette ?",
    media: { type: "image", src: g.src },
    // À la révélation, la jaquette d'origine (avec son titre) en vignette.
    revealMedia: { type: "image", src: coverUrl(g.cover) },
    answers: [{ label: "Jeu", value: g.name }],
  }),
});
