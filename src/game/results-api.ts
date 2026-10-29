import { parseResult, type GameResult } from "./results.ts";

/** Résultats enregistrés par le serveur local ; liste vide si le serveur ne répond pas. */
export async function loadResults(): Promise<GameResult[]> {
  try {
    const res = await fetch("/api/results", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const body = (await res.json()) as unknown;
    return Array.isArray(body) ? body.map(parseResult).filter((r): r is GameResult => r !== null) : [];
  } catch {
    return [];
  }
}

/** Enregistre une partie ; renvoie tous les résultats, ou null si l'enregistrement a échoué. */
export async function saveResult(result: GameResult): Promise<GameResult[] | null> {
  try {
    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? ((await res.json()) as GameResult[]) : null;
  } catch {
    return null;
  }
}
