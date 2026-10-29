import { describe, expect, it } from "vitest";
import {
  computeScores,
  isRoundComplete,
  judgeAll,
  judgeRow,
  judgmentOf,
  newRound,
  nextPendingRow,
  outcome,
  togglePlayer,
} from "../src/game/scoring.ts";
import type { Question } from "../src/types.ts";

const single: Question = {
  id: "t:1",
  theme: "t",
  prompt: "?",
  media: { type: "image", src: "x" },
  answers: [{ label: "Réponse", value: "France" }],
};
const music: Question = {
  ...single,
  id: "music:1",
  answers: [
    { label: "Titre", value: "Hey Jude" },
    { label: "Artiste", value: "The Beatles" },
  ],
};

describe("scoring", () => {
  it("une question simple est close après un jugement (même « personne »)", () => {
    const round = newRound(single);
    expect(isRoundComplete(round)).toBe(false);
    expect(isRoundComplete(judgeRow(round, 0, [1]))).toBe(true);
    expect(isRoundComplete(judgeRow(round, 0, []))).toBe(true);
  });

  it("une question musicale demande deux jugements", () => {
    let round = judgeRow(newRound(music), 0, [0]);
    expect(isRoundComplete(round)).toBe(false);
    expect(nextPendingRow(round, 1)).toBe(1);
    round = judgeRow(round, 1, []);
    expect(isRoundComplete(round)).toBe(true);
    expect(nextPendingRow(round)).toBe(-1);
  });

  it("le focus revient sur une ligne non jugée en premier", () => {
    const round = judgeRow(newRound(music), 1, [0]);
    expect(nextPendingRow(round, 2)).toBe(0);
  });

  it("même jugement pour toutes les lignes", () => {
    const round = judgeAll(newRound(music), [1]);
    expect(isRoundComplete(round)).toBe(true);
    expect(computeScores([round], 2)).toEqual([0, 2]);
  });

  it("ignore une ligne hors limites", () => {
    const round = newRound(single);
    expect(judgeRow(round, 3, [0])).toBe(round);
  });

  it("5 joueurs : deux ont trouvé, un point chacun, rien pour les autres", () => {
    const rounds = [judgeRow(newRound(single), 0, [3, 1]), judgeRow(newRound(single), 0, [1])];
    expect(computeScores(rounds, 5)).toEqual([0, 2, 0, 1, 0]);
  });

  it("additionne les points sur la partie", () => {
    const rounds = [
      judgeRow(newRound(single), 0, [0]),
      judgeRow(newRound(single), 0, []),
      judgeRow(judgeRow(newRound(music), 0, [0]), 1, [1]),
      judgeAll(newRound(music), [0]),
      judgeRow(newRound(single), 0, [0, 1]),
    ];
    expect(computeScores(rounds, 2)).toEqual([5, 2]);
  });

  it("sélection : cocher, décocher, sans doublon, triée", () => {
    expect(judgmentOf([3, 1, 3])).toEqual([1, 3]);
    expect(togglePlayer([], 2)).toEqual([2]);
    expect(togglePlayer([2], 0)).toEqual([0, 2]);
    expect(togglePlayer([0, 2], 2)).toEqual([0]);
  });

  it("désigne le gagnant ou les ex aequo en tête", () => {
    expect(outcome([3, 1])).toEqual({ kind: "winner", player: 0 });
    expect(outcome([3, 5, 1])).toEqual({ kind: "winner", player: 1 });
    expect(outcome([2, 2])).toEqual({ kind: "draw", players: [0, 1] });
    expect(outcome([4, 1, 4, 0])).toEqual({ kind: "draw", players: [0, 2] });
  });
});
