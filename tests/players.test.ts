import { describe, expect, it } from "vitest";
import { biggestWin, computeStandings, marginLabel, parseResult, scoreLine, winnerName, type GameResult } from "../src/game/results.ts";
import { defaultPlayerName, GameStorage, memoryStore } from "../src/game/storage.ts";

const game = (players: string[], scores: number[], complete = true): GameResult => ({
  date: "2026-10-30T20:00:00.000Z",
  players,
  scores,
  questions: 20,
  themes: ["trivia"],
  complete,
});

describe("parties à plusieurs joueurs", () => {
  it("classement : chacun comparé au meilleur de ses adversaires", () => {
    const standings = computeStandings([game(["Arthur", "Marie", "Léa"], [10, 7, 3])]);
    const by = (name: string) => standings.find((s) => s.name === name)!;
    expect(by("Arthur")).toMatchObject({ wins: 1, losses: 0, pointsFor: 10, pointsAgainst: 7, diff: 3 });
    expect(by("Marie")).toMatchObject({ wins: 0, losses: 1, pointsAgainst: 10, diff: -3 });
    expect(by("Léa")).toMatchObject({ wins: 0, losses: 1, diff: -7 });
    expect(standings.map((s) => s.name)).toEqual(["Arthur", "Marie", "Léa"]);
  });

  it("égalité en tête : nul pour les ex aequo, défaite pour les autres", () => {
    const standings = computeStandings([game(["A", "B", "C"], [5, 5, 2])]);
    expect(standings.find((s) => s.name === "A")).toMatchObject({ draws: 1, wins: 0 });
    expect(standings.find((s) => s.name === "C")).toMatchObject({ losses: 1 });
  });

  it("écart, vainqueur et score d'une partie", () => {
    const r = game(["Arthur", "Marie", "Léa"], [4, 9, 6]);
    expect(marginLabel(r.scores)).toBe("+3");
    expect(winnerName(r)).toBe("Marie");
    expect(scoreLine(r)).toBe("Marie 9 · Léa 6 · Arthur 4");
    expect(winnerName(game(["A", "B", "C"], [3, 3, 1]))).toBeNull();
    expect(biggestWin([r, game(["A", "B"], [10, 2])])?.players).toEqual(["A", "B"]);
  });

  it("valide de 2 à 8 joueurs, avec autant de scores que de joueurs", () => {
    expect(parseResult(game(["A", "B", "C", "D", "E"], [1, 2, 3, 4, 5]))).not.toBeNull();
    expect(parseResult(game(["A"], [1]))).toBeNull();
    expect(parseResult(game(["A", "B", "C", "D", "E", "F", "G", "H", "I"], [1, 1, 1, 1, 1, 1, 1, 1, 1]))).toBeNull();
    expect(parseResult(game(["A", "B", "C"], [1, 2]))).toBeNull();
  });

  it("réglages : nombre de joueurs et noms enregistrés", () => {
    const store = memoryStore();
    const players = ["Arthur", "Marie", "Léa", "Tom", "Inès"];
    new GameStorage(store).saveSettings({ themes: [], questionCount: 10, timerSeconds: 20, players });
    expect(new GameStorage(store).loadSettings().players).toEqual(players);
    store.setItem("megaquiz.settings", JSON.stringify({ players: ["Seul"] }));
    expect(new GameStorage(store).loadSettings().players).toEqual(["Arthur", "Marie"]);
    expect(defaultPlayerName(1)).toBe("Marie");
    expect(defaultPlayerName(4)).toBe("Joueur 5");
  });
});
