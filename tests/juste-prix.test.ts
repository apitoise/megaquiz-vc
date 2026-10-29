import { describe, expect, it } from "vitest";
import countriesData from "../data/countries.json";
import franceData from "../data/france_map.json";
import justePrixData from "../data/juste_prix.json";
import type { Country } from "../src/data/countries.ts";
import type { FranceMap } from "../src/data/france.ts";
import type { PriceQuestion } from "../src/data/juste-prix.ts";
import { keyToAction } from "../src/game/keys.ts";
import { computeScores, judgeRow, newRound } from "../src/game/scoring.ts";
import { capitals, hasKnownCapital } from "../src/providers/capitals.ts";
import { frenchCities } from "../src/providers/france.ts";
import { justePrix } from "../src/providers/juste-prix.ts";
import { question } from "./helpers.ts";

describe("« Les deux »", () => {
  it("donne un point à chaque joueur", () => {
    const rounds = [judgeRow(newRound(question("t", 1)), 0, "both"), judgeRow(newRound(question("t", 2)), 0, 0)];
    expect(computeScores(rounds)).toEqual([2, 1]);
  });

  it("touche D (et S pour couper le son)", () => {
    expect(keyToAction("d", false)).toEqual({ type: "judge", judgment: "both" });
    expect(keyToAction("s", false)).toEqual({ type: "sound" });
  });
});

describe("capitales sans les tout petits pays", () => {
  const countries = countriesData as Country[];
  const code = (c: string) => countries.find((x) => x.code === c)!;

  it("écarte les petites îles hors d'Europe, garde les micro-États européens", () => {
    for (const small of ["FM", "MH", "KN", "DM", "TV", "SG", "BH"]) expect(hasKnownCapital(code(small)), small).toBe(false);
    for (const kept of ["LU", "MT", "MC", "VA", "FR", "JM", "LB"]) expect(hasKnownCapital(code(kept)), kept).toBe(true);
  });

  it("le thème ne pose plus ces capitales", async () => {
    capitals.invalidate?.();
    await capitals.init();
    const seen = new Set<string>();
    for (;;) {
      try {
        seen.add((await capitals.next(seen)).id);
      } catch {
        break;
      }
    }
    expect(seen.size).toBe(countries.filter(hasKnownCapital).length);
    expect(seen.has("capitals:FM")).toBe(false);
    expect(seen.has("capitals:LU")).toBe(true);
  });
});

describe("villes de France", () => {
  const map = franceData as FranceMap;

  it("des villes connues, bien réparties, toutes dans la carte", () => {
    expect(map.cities.length).toBeGreaterThanOrEqual(70);
    const names = map.cities.map((c) => c.name);
    for (const city of ["Paris", "Lyon", "Marseille", "Brest", "Ajaccio", "Strasbourg"]) expect(names).toContain(city);
    expect(names).not.toContain("Villeurbanne"); // collée à Lyon
    expect(names).not.toContain("Nanterre"); // collée à Paris
    for (const c of map.cities) {
      expect(c.x).toBeGreaterThan(0);
      expect(c.x).toBeLessThan(map.size);
      expect(c.y).toBeGreaterThan(0);
      expect(c.y).toBeLessThan(map.size);
    }
  });

  it("Brest à l'ouest, Strasbourg à l'est, Lille au nord, Perpignan au sud", () => {
    const at = (n: string) => map.cities.find((c) => c.name === n)!;
    expect(at("Brest").x).toBeLessThan(at("Strasbourg").x);
    expect(at("Lille").y).toBeLessThan(at("Perpignan").y);
  });

  it("question : carte muette avec un point, réponse = ville (département)", async () => {
    await frenchCities.init();
    const lyon = map.cities.find((c) => c.name === "Lyon")!;
    const q = await frenchCities.next(new Set(map.cities.filter((c) => c !== lyon).map((c) => `france-cities:${c.code}`)));
    expect(q.media.type).toBe("svg");
    expect(q.media.src).toContain(`cx="${lyon.x}"`);
    expect(q.media.src).not.toContain("Lyon");
    expect(q.answers).toEqual([{ label: "Ville", value: "Lyon (Rhône)" }]);
  });
});

describe("le juste prix", () => {
  const items = justePrixData as PriceQuestion[];

  it("prix, chiffres et habitants, sans doublon", () => {
    expect(new Set(items.map((q) => q.id)).size).toBe(items.length);
    for (const cat of ["prix", "chiffres", "habitants"]) expect(items.filter((q) => q.category === cat).length, cat).toBeGreaterThanOrEqual(40);
    for (const q of items) {
      expect(q.question, q.id).toMatch(/\?$/);
      expect(q.answer, q.id).toMatch(/\d/);
    }
  });

  it("question illustrée quand une image existe, en texte sinon", async () => {
    await justePrix.init();
    const seen = new Set<string>();
    const types = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const q = await justePrix.next(seen);
      seen.add(q.id);
      types.add(q.media.type);
    }
    expect([...types].sort()).toEqual(["image", "text"]);
  });
});
