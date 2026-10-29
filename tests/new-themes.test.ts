import { describe, expect, it } from "vitest";
import artData from "../data/art.json";
import landmarksData from "../data/landmarks.json";
import summariesData from "../data/summaries_fr.json";
import triviaData from "../data/trivia_fr.json";
import type { Artwork, Landmark } from "../src/data/wiki.ts";
import { planWithRhythm } from "../src/game/plan.ts";
import { seededRng } from "../src/game/random.ts";
import { QuestionSource } from "../src/game/source.ts";
import { summaries } from "../src/providers/summaries.ts";
import { art, landmarks } from "../src/providers/wiki.ts";
import { fakeProvider, okPreload } from "./helpers.ts";

describe("culture générale toutes les 5 questions", () => {
  it("place le thème rythmé aux positions 5, 10, 15…", () => {
    const plan = planWithRhythm(["trivia", "a", "b", "c"], 50, { theme: "trivia", every: 5 }, seededRng(1));
    expect(plan).toHaveLength(50);
    plan.forEach((theme, i) => expect(theme === "trivia", `position ${i + 1}`).toBe((i + 1) % 5 === 0));
  });

  it("répartit équitablement les autres thèmes sur les places restantes", () => {
    const plan = planWithRhythm(["trivia", "a", "b", "c", "d"], 50, { theme: "trivia", every: 5 }, seededRng(2));
    const counts = ["a", "b", "c", "d"].map((t) => plan.filter((x) => x === t).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(counts.reduce((s, n) => s + n, 0)).toBe(40);
  });

  it("sans le thème rythmé, ou s'il est seul, plan ordinaire", () => {
    expect(planWithRhythm(["a", "b"], 10, { theme: "trivia", every: 5 })).not.toContain("trivia");
    expect(planWithRhythm(["trivia"], 4, { theme: "trivia", every: 5 })).toEqual(["trivia", "trivia", "trivia", "trivia"]);
  });

  it("la source de questions respecte le rythme", async () => {
    const src = new QuestionSource({
      providers: [fakeProvider("trivia", 50), fakeProvider("a", 50), fakeProvider("b", 50)],
      count: 20,
      preload: okPreload,
      recent: new Set(),
      blacklist: new Set(),
      rng: seededRng(4),
      rhythm: { theme: "trivia", every: 5 },
    });
    const themes: string[] = [];
    for (let i = 0; i < 20; i++) themes.push((await src.next())!.question.theme);
    expect(themes.filter((t) => t === "trivia")).toHaveLength(4);
    expect([themes[4], themes[9], themes[14], themes[19]]).toEqual(["trivia", "trivia", "trivia", "trivia"]);
  });

  it("le pool compte assez de questions pour plusieurs parties de 50 sans répétition", () => {
    expect(triviaData.questions.length).toBeGreaterThanOrEqual(350);
    expect(new Set(triviaData.questions.map((q) => q.id)).size).toBe(triviaData.questions.length);
  });
});

describe("résumés d'œuvres", () => {
  it("100 résumés en 4 catégories, sans titre de l'œuvre dans le résumé", () => {
    expect(summariesData.items).toHaveLength(100);
    expect(new Set(summariesData.items.map((s) => s.id)).size).toBe(100);
    for (const s of summariesData.items) {
      const title = s.answer.replace(/\s*\(.*\)$/, "").toLowerCase();
      expect(s.summary.toLowerCase().includes(title), `${s.id} contient « ${title} »`).toBe(false);
    }
  });

  it("question texte, catégorie en guise de média", async () => {
    await summaries.init();
    const q = await summaries.next(new Set());
    expect(q.media.type).toBe("text");
    expect(q.media.src).toMatch(/de quelle œuvre s'agit-il \?$/);
    expect(q.prompt.length).toBeGreaterThan(60);
  });
});

describe("art et monuments", () => {
  const artworks = artData as Artwork[];
  const places = landmarksData as Landmark[];

  it("pools vérifiés : images Wikimédia, sans doublon", () => {
    expect(artworks.length).toBeGreaterThanOrEqual(40);
    expect(places.length).toBeGreaterThanOrEqual(50);
    for (const x of [...artworks, ...places]) expect(x.image).toMatch(/^https:\/\/[a-z.]*wikimedia\.org\/.+\.(jpe?g|png)$/i);
    expect(new Set(artworks.map((a) => a.slug)).size).toBe(artworks.length);
    expect(new Set(places.map((p) => p.slug)).size).toBe(places.length);
  });

  it("art : deux jugements (œuvre, artiste), un seul pour une œuvre anonyme", async () => {
    await art.init();
    const only = (slug: string) => new Set(artworks.filter((a) => a.slug !== slug).map((a) => `art:${a.slug}`));
    expect((await art.next(only("la-joconde"))).answers).toEqual([
      { label: "Œuvre", value: "La Joconde" },
      { label: "Artiste", value: "Léonard de Vinci" },
    ]);
    expect((await art.next(only("venus-de-milo"))).answers).toEqual([{ label: "Œuvre", value: "Vénus de Milo" }]);
  });

  it("monuments : le lieu accompagne la réponse", async () => {
    await landmarks.init();
    const q = await landmarks.next(new Set(places.filter((p) => p.slug !== "tour-eiffel").map((p) => `landmarks:${p.slug}`)));
    expect(q.answers).toEqual([{ label: "Lieu", value: "Tour Eiffel (Paris, France)" }]);
  });
});
