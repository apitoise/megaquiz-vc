import { describe, expect, it } from "vitest";
import {
  computeScores,
  isRoundComplete,
  judgeAll,
  judgeRow,
  newRound,
  nextPendingRow,
  outcome,
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
  it("une question simple est close après un jugement", () => {
    const round = newRound(single);
    expect(isRoundComplete(round)).toBe(false);
    expect(isRoundComplete(judgeRow(round, 0, 1))).toBe(true);
  });

  it("une question musicale demande deux jugements", () => {
    let round = judgeRow(newRound(music), 0, 0);
    expect(isRoundComplete(round)).toBe(false);
    expect(nextPendingRow(round, 1)).toBe(1);
    round = judgeRow(round, 1, "none");
    expect(isRoundComplete(round)).toBe(true);
    expect(nextPendingRow(round)).toBe(-1);
  });

  it("le focus revient sur une ligne non jugée en premier", () => {
    const round = judgeRow(newRound(music), 1, 0);
    expect(nextPendingRow(round, 2)).toBe(0);
  });

  it("« les deux → X » attribue tous les points", () => {
    const round = judgeAll(newRound(music), 1);
    expect(isRoundComplete(round)).toBe(true);
    expect(computeScores([round])).toEqual([0, 2]);
  });

  it("ignore une ligne hors limites", () => {
    const round = newRound(single);
    expect(judgeRow(round, 3, 0)).toBe(round);
  });

  it("additionne les points sur la partie", () => {
    const rounds = [
      judgeRow(newRound(single), 0, 0),
      judgeRow(newRound(single), 0, "none"),
      judgeRow(judgeRow(newRound(music), 0, 0), 1, 1),
      judgeAll(newRound(music), 0),
    ];
    expect(computeScores(rounds)).toEqual([4, 1]);
  });

  it("désigne le gagnant ou l'égalité", () => {
    expect(outcome([3, 1])).toEqual({ kind: "winner", player: 0 });
    expect(outcome([3, 5])).toEqual({ kind: "winner", player: 1 });
    expect(outcome([2, 2])).toEqual({ kind: "draw" });
  });
});
