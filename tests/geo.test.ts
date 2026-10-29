import { describe, expect, it } from "vitest";
import countriesData from "../data/countries.json";
import shapesData from "../data/shapes.json";
import type { Country } from "../src/data/countries.ts";
import { capitals } from "../src/providers/capitals.ts";
import { flags } from "../src/providers/flags.ts";
import { MIN_SHAPE_AREA_KM2, shapes } from "../src/providers/shapes.ts";
import { PoolExhaustedError, type QuestionProvider } from "../src/types.ts";

const countries = countriesData as Country[];
const paths = shapesData as Record<string, string>;

describe("data/countries.json", () => {
  it("contient les 193 membres de l'ONU et les 2 observateurs, sans doublon", () => {
    expect(countries).toHaveLength(195);
    expect(new Set(countries.map((c) => c.code)).size).toBe(195);
    expect(countries.map((c) => c.code)).toEqual(expect.arrayContaining(["FR", "VA", "PS", "SS"]));
    // Pas de territoires.
    expect(countries.map((c) => c.code)).not.toEqual(expect.arrayContaining(["GL"]));
    expect(countries.map((c) => c.code)).not.toContain("PR");
  });

  it("a un nom, une capitale et une forme « de… » en français pour chaque pays", () => {
    for (const c of countries) {
      expect(c.name, c.code).toBeTruthy();
      expect(c.capital, c.code).toBeTruthy();
      expect(c.de, c.code).toMatch(/^(de la |de l'|du |des |de |d')\S/);
    }
    const fr = (code: string) => countries.find((c) => c.code === code)!;
    expect(fr("AT").capital).toBe("Vienne");
    expect(fr("GB").capital).toBe("Londres");
    expect(fr("US").de).toBe("des États-Unis");
  });
});

describe("data/shapes.json", () => {
  it("a une silhouette pour chaque pays au-dessus du seuil de superficie", () => {
    const big = countries.filter((c) => c.area >= MIN_SHAPE_AREA_KM2);
    expect(big.length).toBeGreaterThan(150);
    for (const c of big) expect(paths[c.code], c.code).toMatch(/^M[\d.]+ [\d.]+L/);
  });

  it("des tracés restent dans le carré 400×400", () => {
    for (const [code, d] of Object.entries(paths)) {
      const nums = d.match(/-?[\d.]+/g)!.map(Number);
      expect(Math.min(...nums), code).toBeGreaterThanOrEqual(0);
      expect(Math.max(...nums), code).toBeLessThanOrEqual(400);
    }
  });
});

async function drawAll(provider: QuestionProvider) {
  await provider.init();
  const seen = new Set<string>();
  for (;;) {
    try {
      seen.add((await provider.next(seen)).id);
    } catch (err) {
      expect(err).toBeInstanceOf(PoolExhaustedError);
      return seen;
    }
  }
}

describe("thèmes géographiques", () => {
  it("drapeaux : une question par pays, image flagcdn, réponse en français", async () => {
    await flags.init();
    const q = await flags.next(new Set(countries.filter((c) => c.code !== "DE").map((c) => `flags:${c.code}`)));
    expect(q).toMatchObject({
      id: "flags:DE",
      theme: "flags",
      prompt: "De quel pays est ce drapeau ?",
      media: { type: "image", src: "https://flagcdn.com/w640/de.png" },
      answers: [{ label: "Pays", value: "Allemagne" }],
    });
    expect((await drawAll(flags)).size).toBe(195);
  });

  it("capitales : question formulée avec le bon article", async () => {
    await capitals.init();
    const only = (code: string) => new Set(countries.filter((c) => c.code !== code).map((c) => `capitals:${c.code}`));
    expect((await capitals.next(only("JP"))).prompt).toBe("Quelle est la capitale du Japon ?");
    const nl = await capitals.next(only("NL"));
    expect(nl.prompt).toBe("Quelle est la capitale des Pays-Bas ?");
    expect(nl.answers[0].value).toContain("Amsterdam");
  });

  it("formes : exclut les pays trop petits et rend un SVG", async () => {
    const ids = await drawAll(shapes);
    expect(ids.has("shapes:FR")).toBe(true);
    expect(ids.has("shapes:VA")).toBe(false);
    expect(ids.has("shapes:MT")).toBe(false);
    const q = await shapes.next(new Set([...ids].filter((id) => id !== "shapes:RU")));
    expect(q.media.type).toBe("svg");
    expect(q.media.src).toMatch(/^<svg viewBox="0 0 400 400".*<path d="M/);
    expect(q.answers[0].value).toBe("Russie");
  });
});
