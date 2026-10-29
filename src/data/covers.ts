// Jaquettes anonymisées (scripts/covers/anonymize.py) et décisions de relecture.

/** Entrée de public/covers/manifest.json, par image_id IGDB. */
export interface CoverEntry {
  game: string;
  gameId: number;
  /** « sure » : le nom du jeu a été repéré puis effacé ; « a-verifier » : à relire avant d'être posée. */
  status: "sure" | "a-verifier";
  flags: string[];
  /** false si aucun texte n'a été trouvé (la jaquette est alors identique à l'originale). */
  anonymized: boolean;
  maskRatio: number;
  text: string[];
}

export type CoverManifest = Record<string, CoverEntry>;

/** Décision de relecture : « ok » = utilisable en partie, « rejete » = jamais posée. */
export type CoverDecision = "ok" | "rejete";
export type CoverReviews = Record<string, CoverDecision>;

export function anonymizedCoverUrl(imageId: string): string {
  return `/covers/${imageId}.jpg`;
}

/**
 * Jaquette à poser pour une image IGDB, ou null si elle ne doit pas l'être.
 * Sans manifeste (anonymisation jamais lancée), on garde l'originale.
 */
export function coverChoice(
  imageId: string,
  manifest: CoverManifest | null,
  reviews: CoverReviews,
): { kind: "anonymized" | "original" } | null {
  if (reviews[imageId] === "rejete") return null;
  if (!manifest) return { kind: "original" };
  const entry = manifest[imageId];
  if (!entry) return { kind: "original" };
  if (entry.status === "a-verifier" && reviews[imageId] !== "ok") return null;
  return { kind: entry.anonymized ? "anonymized" : "original" };
}

export function isCoverDecision(value: unknown): value is CoverDecision {
  return value === "ok" || value === "rejete";
}
