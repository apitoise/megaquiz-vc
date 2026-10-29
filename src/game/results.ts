// Résultats des parties et classement (logique pure, partagée avec le serveur).
import { MAX_PLAYERS, MIN_PLAYERS } from "../types.ts";

/** Une partie terminée, telle qu'enregistrée dans saves/results.json. */
export interface GameResult {
  /** Date de fin, ISO 8601. */
  date: string;
  /** De 2 à 8 joueurs (les anciennes parties en comptent 2). */
  players: string[];
  scores: number[];
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
 * Seules les parties complètes comptent. À plus de deux joueurs, chacun est comparé au meilleur
 * de ses adversaires : « encaissés » et « différence » se mesurent par rapport à lui (à deux, c'est
 * simplement l'adversaire). Une égalité en tête compte comme un nul pour les ex aequo.
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
    for (let side = 0; side < r.players.length; side++) {
      const me = row(r.players[side]);
      const mine = r.scores[side];
      const theirs = Math.max(...r.scores.filter((_, i) => i !== side));
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

/** Écart entre le premier et le deuxième d'une partie. */
export function margin(scores: readonly number[]): number {
  const [first, second] = [...scores].sort((a, b) => b - a);
  return first - (second ?? first);
}

/** Écart d'une partie, du point de vue du vainqueur (« +7 »), ou « = » en cas d'égalité en tête. */
export function marginLabel(scores: readonly number[]): string {
  const m = margin(scores);
  return m ? `+${m}` : "=";
}

/** Vainqueur d'une partie (le meilleur score), ou null en cas d'égalité en tête. */
export function winnerName(r: GameResult): string | null {
  if (!margin(r.scores)) return null;
  return r.players[r.scores.indexOf(Math.max(...r.scores))];
}

/** Score d'une partie, du meilleur au moins bon : « Arthur 12 · Marie 9 · Léa 4 ». */
export function scoreLine(r: GameResult): string {
  return r.players
    .map((name, i) => ({ name, score: r.scores[i] }))
    .sort((a, b) => b.score - a.score)
    .map((p) => `${p.name} ${p.score}`)
    .join(" · ");
}

/** Plus large victoire parmi les parties complètes. */
export function biggestWin(results: readonly GameResult[]): GameResult | null {
  let best: GameResult | null = null;
  for (const r of results) {
    if (!r.complete) continue;
    const m = margin(r.scores);
    if (m > 0 && (!best || m > margin(best.scores))) best = r;
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
  if (!Array.isArray(v.players) || v.players.length < MIN_PLAYERS || v.players.length > MAX_PLAYERS || !v.players.every(isName)) return null;
  if (!Array.isArray(v.scores) || v.scores.length !== v.players.length || !v.scores.every(isScore)) return null;
  if (!isScore(v.questions)) return null;
  if (!Array.isArray(v.themes) || !v.themes.every((t) => typeof t === "string" && t.length <= 40) || v.themes.length > 50) return null;
  if (typeof v.complete !== "boolean") return null;
  return {
    date: v.date,
    players: v.players as string[],
    scores: v.scores as number[],
    questions: v.questions,
    themes: v.themes as string[],
    complete: v.complete,
  };
}
