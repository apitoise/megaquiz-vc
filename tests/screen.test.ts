import { describe, expect, it } from "vitest";
import filmsData from "../data/films.json";
import seriesData from "../data/series.json";
import type { ScreenWork } from "../src/data/screen.ts";
import { filmImages, filmPosters, seriesImages, seriesPosters } from "../src/providers/screen.ts";

const films = filmsData as ScreenWork[];
const series = seriesData as ScreenWork[];

describe("data/films.json et data/series.json", () => {
  it("300 films et 150 séries, sans doublon", () => {
    expect(films).toHaveLength(300);
    expect(series).toHaveLength(150);
    for (const works of [films, series]) {
      expect(new Set(works.map((w) => w.id)).size).toBe(works.length);
      expect(new Set(works.map((w) => w.name)).size).toBe(works.length);
    }
  });

  it("ne contient que des chemins d'images (pas d'URL, pas de jeton)", () => {
    const text = JSON.stringify([films, series]);
    expect(text).not.toMatch(/https?:|Bearer|eyJ/);
    for (const w of [...films, ...series]) {
      if (w.textlessPoster) expect(w.textlessPoster).toMatch(/^\/\w+\.(jpg|png)$/);
      for (const b of w.backdrops) expect(b).toMatch(/^\/\w+\.(jpg|png)$/);
    }
  });

  it("titre français, original entre parenthèses seulement s'il diffère", () => {
    expect(films.find((w) => w.id === 27205)?.name).toBe("Inception");
    expect(series.find((w) => w.id === 1396)?.name).toBe("Breaking Bad");
    expect(films.some((w) => /\(.+\)$/.test(w.name))).toBe(true);
  });
});

async function onlyQuestion(provider: typeof filmPosters, works: ScreenWork[], keep: number, prefix: string) {
  provider.invalidate?.();
  await provider.init();
  return provider.next(new Set(works.filter((w) => w.id !== keep).map((w) => `${prefix}:${w.id}`)));
}

describe("thèmes films et séries", () => {
  it("affiche : l'affiche sans texte, et l'affiche officielle à la révélation", async () => {
    const matrix = films.find((w) => w.id === 603)!;
    const q = await onlyQuestion(filmPosters, films, 603, "film-posters");
    expect(q).toMatchObject({
      prompt: "De quel film est cette affiche ?",
      media: { type: "image", src: `https://image.tmdb.org/t/p/w780${matrix.textlessPoster}` },
      revealMedia: { type: "image", src: `https://image.tmdb.org/t/p/w780${matrix.poster}` },
      answers: [{ label: "Film", value: matrix.name }],
    });
  });

  it("image : une image de scène de l'œuvre, tirée au hasard", async () => {
    const bb = series.find((w) => w.id === 1396)!;
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add((await onlyQuestion(seriesImages, series, 1396, "series-images")).media.src);
    expect(seen.size).toBeGreaterThan(1);
    for (const src of seen) expect(bb.backdrops.map((b) => `https://image.tmdb.org/t/p/w1280${b}`)).toContain(src);
  });

  it("une œuvre sans affiche sans texte n'est pas posée dans le thème affiches", async () => {
    const without = series.filter((w) => !w.textlessPoster);
    seriesPosters.invalidate?.();
    await seriesPosters.init();
    const ids = new Set<string>();
    for (;;) {
      try {
        ids.add((await seriesPosters.next(ids)).id);
      } catch {
        break;
      }
    }
    expect(ids.size).toBe(series.length - without.length);
    for (const w of without) expect(ids.has(`series-posters:${w.id}`)).toBe(false);
    await filmImages.init();
  });
});
