import type { Judgment, PlayerIndex, Question } from "../types.ts";

/** Une question jouée : un jugement par ligne de réponse (`null` tant que non jugée). */
export interface Round {
  question: Question;
  judgments: (Judgment | null)[];
}

export function newRound(question: Question): Round {
  return { question, judgments: question.answers.map(() => null) };
}

export function isRoundComplete(round: Round): boolean {
  return round.judgments.every((j) => j !== null);
}

/** Jugement normalisé : indices uniques, triés. */
export function judgmentOf(players: Iterable<PlayerIndex>): Judgment {
  return [...new Set(players)].sort((a, b) => a - b);
}

/** Ajoute ou retire un joueur d'une sélection. */
export function togglePlayer(selection: Judgment, player: PlayerIndex): Judgment {
  return selection.includes(player) ? selection.filter((p) => p !== player) : judgmentOf([...selection, player]);
}

/** Juge une ligne (un nouveau jugement remplace l'ancien tant que la question n'est pas close). */
export function judgeRow(round: Round, row: number, judgment: Judgment): Round {
  if (row < 0 || row >= round.judgments.length) return round;
  const judgments = [...round.judgments];
  judgments[row] = judgmentOf(judgment);
  return { ...round, judgments };
}

/** Même jugement pour toutes les lignes (ex. titre et artiste trouvés par les mêmes joueurs). */
export function judgeAll(round: Round, judgment: Judgment): Round {
  const normalized = judgmentOf(judgment);
  return { ...round, judgments: round.judgments.map(() => normalized) };
}

/** Première ligne non jugée, ou -1. */
export function nextPendingRow(round: Round, from = 0): number {
  for (let i = 0; i < round.judgments.length; i++) {
    const row = (from + i) % round.judgments.length;
    if (round.judgments[row] === null) return row;
  }
  return -1;
}

/** Un point par ligne trouvée par le joueur (plusieurs joueurs peuvent marquer sur la même ligne). */
export function roundPoints(round: Round, player: PlayerIndex): number {
  return round.judgments.filter((j) => j?.includes(player)).length;
}

export function computeScores(rounds: readonly Round[], playerCount: number): number[] {
  return Array.from({ length: playerCount }, (_, player) => rounds.reduce((sum, r) => sum + roundPoints(r, player), 0));
}

export type Outcome = { kind: "winner"; player: PlayerIndex } | { kind: "draw"; players: PlayerIndex[] };

/** Vainqueur unique, ou égalité entre les meilleurs scores. */
export function outcome(scores: readonly number[]): Outcome {
  const best = Math.max(...scores);
  const top = scores.flatMap((s, i) => (s === best ? [i] : []));
  return top.length === 1 ? { kind: "winner", player: top[0] } : { kind: "draw", players: top };
}
