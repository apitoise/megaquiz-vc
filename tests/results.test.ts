import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appendResult, readResults } from "../server/results.ts";
import { biggestWin, computeStandings, marginLabel, parseResult, type GameResult } from "../src/game/results.ts";

const game = (scores: [number, number], complete = true, players: [string, string] = ["Arthur", "Marie"]): GameResult => ({
  date: "2026-10-29T20:00:00.000Z",
  players,
  scores,
  questions: 50,
  themes: ["flags"],
  complete,
});

describe("computeStandings", () => {
  it("compte victoires, nuls, défaites et la différence de points cumulée", () => {
    const [arthur, marie] = computeStandings([game([30, 22]), game([18, 25]), game([20, 20]), game([27, 19])]);
    expect(arthur).toMatchObject({ name: "Arthur", played: 4, wins: 2, draws: 1, losses: 1, pointsFor: 95, pointsAgainst: 86, diff: 9 });
    expect(marie).toMatchObject({ name: "Marie", played: 4, wins: 1, draws: 1, losses: 2, diff: -9 });
  });

  it("départage à victoires égales par la différence de points", () => {
    const standings = computeStandings([game([30, 29]), game([10, 25])]);
    expect(standings.map((s) => s.name)).toEqual(["Marie", "Arthur"]);
    expect(standings[0].diff).toBe(14);
  });

  it("ignore les parties interrompues", () => {
    const [arthur] = computeStandings([game([30, 22]), game([5, 0], false)]);
    expect(arthur.played).toBe(1);
  });

  it("reconnaît un joueur quel que soit son côté et la casse de son nom", () => {
    const standings = computeStandings([game([30, 22]), game([25, 20], true, ["marie", "ARTHUR"])]);
    expect(standings).toHaveLength(2);
    expect(standings.find((s) => s.name.toLowerCase() === "arthur")).toMatchObject({ wins: 1, losses: 1, diff: 3 });
  });
});

describe("écarts", () => {
  it("formate l'écart d'une partie", () => {
    expect(marginLabel([30, 22])).toBe("+8");
    expect(marginLabel([18, 25])).toBe("+7");
    expect(marginLabel([20, 20])).toBe("=");
  });

  it("trouve la plus large victoire (parties complètes)", () => {
    expect(biggestWin([game([30, 22]), game([5, 40]), game([50, 0], false)])?.scores).toEqual([5, 40]);
    expect(biggestWin([game([20, 20])])).toBeNull();
  });
});

describe("parseResult", () => {
  it("accepte un résultat valide et rejette le reste", () => {
    expect(parseResult(game([1, 2]))).toEqual(game([1, 2]));
    expect(parseResult({ ...game([1, 2]), scores: [1, -2] })).toBeNull();
    expect(parseResult({ ...game([1, 2]), players: ["Arthur"] })).toBeNull();
    expect(parseResult({ ...game([1, 2]), date: "hier" })).toBeNull();
    expect(parseResult("n'importe quoi")).toBeNull();
  });
});

describe("sauvegarde locale", () => {
  it("ajoute les résultats au fichier et les relit", async () => {
    const dir = await mkdtemp(join(tmpdir(), "megaquiz-"));
    const file = join(dir, "sub", "results.json");
    try {
      expect(await readResults(file)).toEqual([]);
      await appendResult(game([30, 22]), file);
      const all = await appendResult(game([10, 12]), file);
      expect(all).toHaveLength(2);
      expect(await readResults(file)).toEqual(all);
      expect(JSON.parse(await readFile(file, "utf8"))).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
