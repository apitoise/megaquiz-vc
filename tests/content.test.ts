import { describe, expect, it } from "vitest";
import countriesData from "../data/countries.json";
import filmData from "../data/film_music.json";
import musicData from "../data/music.json";
import seriesData from "../data/series_music.json";
import triviaData from "../data/trivia_fr.json";
import type { Country } from "../src/data/countries.ts";
import type { Track } from "../src/data/music.ts";
import type { Soundtrack } from "../src/data/ost.ts";
import { seededRng } from "../src/game/random.ts";
import { judgeAlbums, type AlbumCandidate } from "../src/music/ost-match.ts";
import { capitals } from "../src/providers/capitals.ts";
import { pickBalanced } from "../src/providers/pool.ts";
import { shapes } from "../src/providers/shapes.ts";
import { trivia } from "../src/providers/trivia.ts";

const countries = countriesData as Country[];

describe("pickBalanced", () => {
  const items = [...Array(50)].map((_, i) => ({ id: `a${i}`, g: "a" })).concat([{ id: "b0", g: "b" }, { id: "c0", g: "c" }]);

  it("tire les groupes à parts égales, quelle que soit leur taille", () => {
    const rng = seededRng(3);
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 3000; i++) counts[pickBalanced(items, (x) => x.id, (x) => x.g, new Set(), null, rng)!.group]++;
    for (const g of ["a", "b", "c"]) expect(counts[g]).toBeGreaterThan(850);
  });

  it("évite le groupe précédent tant qu'un autre est disponible", () => {
    for (let i = 0; i < 100; i++) expect(pickBalanced(items, (x) => x.id, (x) => x.g, new Set(), "a")!.group).not.toBe("a");
    const onlyA = new Set(["b0", "c0"]);
    expect(pickBalanced(items, (x) => x.id, (x) => x.g, onlyA, "a")!.group).toBe("a");
  });

  it("respecte les exclusions et renvoie undefined quand tout est exclu", () => {
    expect(pickBalanced(items, (x) => x.id, (x) => x.g, new Set(items.map((x) => x.id)), null)).toBeUndefined();
  });
});

async function drawAll(provider: typeof shapes, n = 400) {
  await provider.init();
  const seen: string[] = [];
  for (let i = 0; i < n; i++) {
    try {
      seen.push((await provider.next(new Set(seen))).id);
    } catch {
      break;
    }
  }
  return seen;
}

describe("géographie", () => {
  it("chaque pays a un continent", () => {
    for (const c of countries) expect(["Africa", "Americas", "Asia", "Europe", "Oceania"], c.code).toContain(c.region);
  });

  it("formes : uniquement l'Europe et les Amériques", async () => {
    const ids = await drawAll(shapes);
    const regions = new Set(ids.map((id) => countries.find((c) => `shapes:${c.code}` === id)!.region));
    expect([...regions].sort()).toEqual(["Americas", "Europe"]);
    expect(ids).toContain("shapes:FR");
    expect(ids).toContain("shapes:BR");
    expect(ids).not.toContain("shapes:CN");
    expect(ids).not.toContain("shapes:NG");
  });

  it("capitales : continents variés, jamais deux fois de suite le même", async () => {
    capitals.invalidate?.();
    await capitals.init();
    const seen = new Set<string>();
    const regions: string[] = [];
    for (let i = 0; i < 40; i++) {
      const q = await capitals.next(seen);
      seen.add(q.id);
      regions.push(countries.find((c) => `capitals:${c.code}` === q.id)!.region);
    }
    for (let i = 1; i < regions.length; i++) expect(regions[i]).not.toBe(regions[i - 1]);
    // L'Afrique (28 % des pays) ne dépasse pas sa part d'un continent sur cinq.
    expect(regions.filter((r) => r === "Africa").length).toBeLessThanOrEqual(12);
  });
});

describe("culture générale", () => {
  const data = triviaData as { categories: Record<string, string>; questions: { id: string; category: string; question: string; answer: string }[] };

  it("questions complètes, sans doublon, dans des catégories connues", () => {
    expect(data.questions.length).toBeGreaterThanOrEqual(200);
    expect(new Set(data.questions.map((q) => q.id)).size).toBe(data.questions.length);
    expect(new Set(data.questions.map((q) => q.question)).size).toBe(data.questions.length);
    for (const q of data.questions) {
      expect(data.categories[q.category], q.id).toBeTruthy();
      expect(q.question, q.id).toMatch(/\?$/);
      expect(q.answer.trim(), q.id).not.toBe("");
    }
  });

  it("produit une question texte avec sa catégorie en guise de média", async () => {
    await trivia.init();
    const q = await trivia.next(new Set());
    expect(q.media.type).toBe("text");
    expect(Object.values(data.categories)).toContain(q.media.src);
    expect(q.answers).toHaveLength(1);
  });
});

describe("musique", () => {
  const tracks = musicData as Track[];

  it("chaque morceau a un style, et chaque style pèse assez pour un tirage équilibré", () => {
    const counts = new Map<string, number>();
    for (const t of tracks) counts.set(t.style, (counts.get(t.style) ?? 0) + 1);
    expect([...counts.keys()].sort()).toEqual(["dance", "rap", "retro", "rock", "soul", "tubes", "variete"]);
    for (const [style, n] of counts) expect(n, style).toBeGreaterThanOrEqual(80);
  });
});

describe("musique des films et séries", () => {
  const album = (title: string, artist = "Hans Zimmer", nb_tracks = 20): AlbumCandidate => ({ id: Math.random(), title, artist, nb_tracks, record_type: "album" });

  it("accepte une OST de film « Motion Picture » et rejette les jeux homonymes", () => {
    expect(judgeAlbums("Inception", [album("Inception (Music from the Motion Picture)")], "film").status).toBe("ok");
    expect(judgeAlbums("Joker", [album("JOKER GAME Original Soundtrack", "Taisei Iwasaki")], "film").status).toBe("absent");
  });

  it("rejette les reprises signées d'un orchestre générique", () => {
    expect(judgeAlbums("Grease", [album("Grease (The Motion Picture Soundtrack)", "West End Orchestra and Singers")], "film").status).toBe("absent");
  });

  it("série : accepte un générique en single, rejette un film homonyme", () => {
    expect(judgeAlbums("Euphoria", [album("Euphoria (Original Score from the HBO Series)", "Labrinth", 1)], "series").status).toBe("ok");
    expect(judgeAlbums("Dune", [album("Dune (Original Motion Picture Soundtrack)")], "series").status).toBe("absent");
  });

  it("pools construits : des œuvres avec des pistes, sans doublon", () => {
    for (const works of [filmData, seriesData] as Soundtrack[][]) {
      expect(works.length).toBeGreaterThanOrEqual(25);
      expect(new Set(works.map((w) => w.slug)).size).toBe(works.length);
      for (const w of works) expect(w.tracks.length, w.name).toBeGreaterThanOrEqual(1);
    }
  });
});
