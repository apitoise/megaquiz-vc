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

/** Juge une ligne (un nouveau jugement remplace l'ancien tant que la question n'est pas close). */
export function judgeRow(round: Round, row: number, judgment: Judgment): Round {
  if (row < 0 || row >= round.judgments.length) return round;
  const judgments = [...round.judgments];
  judgments[row] = judgment;
  return { ...round, judgments };
}

/** Juge toutes les lignes d'un coup (raccourci « les deux → X »). */
export function judgeAll(round: Round, judgment: Judgment): Round {
  return { ...round, judgments: round.judgments.map(() => judgment) };
}

/** Première ligne non jugée, ou -1. */
export function nextPendingRow(round: Round, from = 0): number {
  for (let i = 0; i < round.judgments.length; i++) {
    const row = (from + i) % round.judgments.length;
    if (round.judgments[row] === null) return row;
  }
  return -1;
}

export function roundPoints(round: Round, player: PlayerIndex): number {
  return round.judgments.filter((j) => j === player).length;
}

export function computeScores(rounds: readonly Round[]): [number, number] {
  return [
    rounds.reduce((sum, r) => sum + roundPoints(r, 0), 0),
    rounds.reduce((sum, r) => sum + roundPoints(r, 1), 0),
  ];
}

export type Outcome = { kind: "winner"; player: PlayerIndex } | { kind: "draw" };

export function outcome(scores: [number, number]): Outcome {
  if (scores[0] === scores[1]) return { kind: "draw" };
  return { kind: "winner", player: scores[0] > scores[1] ? 0 : 1 };
}
