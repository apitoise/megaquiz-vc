// Résultats des parties et classement (logique pure, partagée avec le serveur).

/** Une partie terminée, telle qu'enregistrée dans saves/results.json. */
export interface GameResult {
  /** Date de fin, ISO 8601. */
  date: string;
  players: [string, string];
  scores: [number, number];
  /** Questions jouées. */
  questions: number;
  themes: string[];
  /** false si la partie a été arrêtée avec « Terminer » : elle ne compte pas au classement. */
  complete: boolean;
}

export interface Standing {
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Différence de points cumulée (pour − contre). */
  diff: number;
}

/** Les joueurs sont identifiés par leur nom, sans tenir compte de la casse ni des espaces autour. */
export function playerKey(name: string): string {
  return name.trim().toLocaleLowerCase("fr");
}

/**
 * Classement : victoires, puis différence de points, puis points marqués.
 * Seules les parties complètes comptent.
 */
export function computeStandings(results: readonly GameResult[]): Standing[] {
  const table = new Map<string, Standing>();
  const row = (name: string) => {
    const key = playerKey(name);
    let s = table.get(key);
    if (!s) table.set(key, (s = { name: name.trim(), played: 0, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0 }));
    s.name = name.trim(); // garde la graphie la plus récente
    return s;
  };
  for (const r of results) {
    if (!r.complete) continue;
    for (const side of [0, 1] as const) {
      const me = row(r.players[side]);
      const mine = r.scores[side];
      const theirs = r.scores[1 - side];
      me.played++;
      me.pointsFor += mine;
      me.pointsAgainst += theirs;
      me.diff += mine - theirs;
      if (mine > theirs) me.wins++;
      else if (mine < theirs) me.losses++;
      else me.draws++;
    }
  }
  return [...table.values()].sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.pointsFor - a.pointsFor || a.name.localeCompare(b.name, "fr"));
}

/** Écart d'une partie, signé du point de vue du vainqueur (« +7 »), ou « = » en cas d'égalité. */
export function marginLabel(scores: [number, number]): string {
  const margin = Math.abs(scores[0] - scores[1]);
  return margin ? `+${margin}` : "=";
}

/** Plus large victoire parmi les parties complètes. */
export function biggestWin(results: readonly GameResult[]): GameResult | null {
  let best: GameResult | null = null;
  for (const r of results) {
    if (!r.complete) continue;
    const margin = Math.abs(r.scores[0] - r.scores[1]);
    if (margin > 0 && (!best || margin > Math.abs(best.scores[0] - best.scores[1]))) best = r;
  }
  return best;
}

/** Valide un résultat reçu (fichier ou requête) ; renvoie null s'il est invalide. */
export function parseResult(value: unknown): GameResult | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const isName = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= 40;
  const isScore = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 10_000;
  if (typeof v.date !== "string" || Number.isNaN(Date.parse(v.date))) return null;
  if (!Array.isArray(v.players) || v.players.length !== 2 || !v.players.every(isName)) return null;
  if (!Array.isArray(v.scores) || v.scores.length !== 2 || !v.scores.every(isScore)) return null;
  if (!isScore(v.questions)) return null;
  if (!Array.isArray(v.themes) || !v.themes.every((t) => typeof t === "string" && t.length <= 40) || v.themes.length > 50) return null;
  if (typeof v.complete !== "boolean") return null;
  return {
    date: v.date,
    players: [v.players[0] as string, v.players[1] as string],
    scores: [v.scores[0] as number, v.scores[1] as number],
    questions: v.questions,
    themes: v.themes as string[],
    complete: v.complete,
  };
}
