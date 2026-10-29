import { describe, expect, it } from "vitest";
import { planThemes } from "../src/game/plan.ts";
import { seededRng } from "../src/game/random.ts";

const counts = (seq: string[]) => seq.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map<string, number>());

describe("planThemes", () => {
  it("produit exactement le nombre de questions demandé", () => {
    expect(planThemes(["a", "b", "c"], 50, seededRng(1))).toHaveLength(50);
  });

  it("répartit équitablement (écart d'au plus 1 entre thèmes)", () => {
    for (let seed = 0; seed < 50; seed++) {
      const seq = planThemes(["a", "b", "c", "d", "e", "f", "g"], 50, seededRng(seed));
      const values = [...counts(seq).values()];
      expect(values).toHaveLength(7);
      expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    }
  });

  it("évite deux questions consécutives du même thème quand c'est possible", () => {
    for (let seed = 0; seed < 50; seed++) {
      const seq = planThemes(["a", "b", "c"], 50, seededRng(seed));
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    }
  });

  it("gère un thème unique et les cas limites", () => {
    expect(planThemes(["solo"], 3)).toEqual(["solo", "solo", "solo"]);
    expect(planThemes([], 10)).toEqual([]);
    expect(planThemes(["a"], 0)).toEqual([]);
  });

  it("varie d'une partie à l'autre", () => {
    const a = planThemes(["a", "b", "c"], 30, seededRng(1)).join();
    const b = planThemes(["a", "b", "c"], 30, seededRng(2)).join();
    expect(a).not.toBe(b);
  });
});
