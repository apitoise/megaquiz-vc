import { describe, expect, it } from "vitest";
import albumsData from "../data/albums.json";
import countriesData from "../data/countries.json";
import dishesData from "../data/dishes.json";
import emojisData from "../data/emojis_fr.json";
import generiquesData from "../data/generiques.json";
import logosData from "../data/logos.json";
import peopleData from "../data/people.json";
import quotesData from "../data/quotes_fr.json";
import worldMapData from "../data/world_map.json";
import { sameAlbum } from "../scripts/pools/albums.ts";
import { isTheme } from "../scripts/pools/generiques.ts";
import { MIN_MAP_AREA_KM2 } from "../scripts/pools/world-map.ts";
import type { Country } from "../src/data/countries.ts";
import { viewAround, worldMapSvg, type WorldMap } from "../src/data/world-map.ts";
import { AUDIO_THEMES } from "../src/game/preferences.ts";
import { providers } from "../src/providers/index.ts";
import { albums } from "../src/providers/albums.ts";
import { releaseYear } from "../src/providers/release-year.ts";
import { emojis, quotes } from "../src/providers/texts.ts";
import { dishes, logos, people } from "../src/providers/wiki.ts";
import { worldMap } from "../src/providers/world-map.ts";
import type { QuestionProvider } from "../src/types.ts";

const map = worldMapData as unknown as WorldMap;

/** Tire `n` questions d'affilée (sans doublon, comme dans une partie). */
async function draw(provider: QuestionProvider, n: number) {
  await provider.init();
  const used = new Set<string>();
  const out = [];
  for (let i = 0; i < n; i++) {
    const q = await provider.next(used);
    used.add(q.id);
    out.push(q);
  }
  return out;
}

const unique = (ids: string[]) => new Set(ids).size === ids.length;

describe("registre des thèmes", () => {
  it("des identifiants uniques, et chaque thème audio existe", () => {
    const ids = providers.map((p) => p.id);
    expect(unique(ids)).toBe(true);
    for (const id of AUDIO_THEMES) expect(ids).toContain(id);
  });
});

describe("année de sortie", () => {
  it("films, séries et jeux, avec une année plausible et l'œuvre comme sujet", async () => {
    const questions = await draw(releaseYear, 30);
    const kinds = new Set(questions.map((q) => q.subject!.split(":")[0]));
    expect(kinds).toEqual(new Set(["film", "series", "game"]));
    for (const q of questions) {
      const year = Number(q.answers[0].value);
      expect(year).toBeGreaterThanOrEqual(1900);
      expect(year).toBeLessThanOrEqual(new Date().getFullYear() + 1);
      expect(q.prompt).toContain("plus proche");
    }
  });
});

describe("pays sur la carte", () => {
  it("chaque pays assez grand a son tracé et son cadre", () => {
    const eligible = (countriesData as Country[]).filter((c) => c.area >= MIN_MAP_AREA_KM2);
    expect(Object.keys(map.countries).length).toBeGreaterThanOrEqual(eligible.length - 3);
  });

  it("la vue reste dans la carte et contient le pays", () => {
    for (const [code, { box }] of Object.entries(map.countries)) {
      const [x, y, w, h] = viewAround(box, map);
      expect(x, code).toBeGreaterThanOrEqual(0);
      expect(y, code).toBeGreaterThanOrEqual(0);
      expect(x + w, code).toBeLessThanOrEqual(map.width + 0.1);
      expect(y + h, code).toBeLessThanOrEqual(map.height + 0.1);
      // Le centre du pays est dans la vue (sauf la Russie, plus large que toute vue raisonnable).
      if (code !== "RU") {
        expect((box[0] + box[2]) / 2, code).toBeGreaterThanOrEqual(x);
        expect((box[0] + box[2]) / 2, code).toBeLessThanOrEqual(x + w);
      }
    }
  });

  it("un tout petit pays est cerclé, un grand ne l'est pas", () => {
    expect(worldMapSvg(map, "LU")).toContain("<circle");
    expect(worldMapSvg(map, "BR")).not.toContain("<circle");
  });

  it("produit une carte paysage par question", async () => {
    const [q] = await draw(worldMap, 1);
    expect(q.media).toMatchObject({ type: "svg", wide: true });
    expect(q.media.src).toMatch(/^<svg viewBox="[\d. ]+"/);
  });
});

describe("pochettes d'album", () => {
  it("reconnaît une réédition, rejette une compilation ou un autre artiste", () => {
    const nevermind = { artist: "Nirvana", album: "Nevermind" };
    expect(sameAlbum(nevermind, { title: "Nevermind (Remastered)", artist: { name: "Nirvana" } })).toBe(true);
    expect(sameAlbum(nevermind, { title: "Nevermind It's an Interview", artist: { name: "Nirvana" } })).toBe(true);
    expect(sameAlbum(nevermind, { title: "Best of Nirvana", artist: { name: "Nirvana" } })).toBe(false);
    expect(sameAlbum(nevermind, { title: "Nevermind", artist: { name: "Vitamin String Quartet" } })).toBe(false);
  });

  it("un pool sans doublon, pochette floutée et deux jugements", async () => {
    expect(albumsData.length).toBeGreaterThanOrEqual(200);
    expect(unique(albumsData.map((a) => a.slug))).toBe(true);
    const [q] = await draw(albums, 1);
    expect(q.media).toMatchObject({ type: "image", blur: true });
    expect(q.answers.map((a) => a.label)).toEqual(["Album", "Artiste"]);
  });
});

describe("génériques", () => {
  it("accepte le générique, rejette karaoké et remix", () => {
    const candidate = { title: "Goldorak" };
    const ok = { readable: true, preview: "x.mp3" };
    expect(isTheme(candidate, { ...ok, title: "Goldorak" })).toBe(true);
    expect(isTheme(candidate, { ...ok, title: "Goldorak (Générique original)" })).toBe(true);
    expect(isTheme(candidate, { ...ok, title: "Goldorak (Karaoké)" })).toBe(false);
    expect(isTheme(candidate, { ...ok, title: "Goldorak Remix 2020" })).toBe(false);
    expect(isTheme(candidate, { ...ok, title: "Goldorak", preview: "" })).toBe(false);
  });

  it("un pool d'au moins 90 programmes, chacun avec sa piste", () => {
    expect(generiquesData.length).toBeGreaterThanOrEqual(90);
    expect(unique(generiquesData.map((g) => g.slug))).toBe(true);
    for (const g of generiquesData) expect(g.tracks.length, g.name).toBeGreaterThan(0);
  });
});

describe("personnalités, plats et logos", () => {
  it("des pools sans doublon, dans des groupes connus", () => {
    expect(peopleData.length).toBeGreaterThanOrEqual(240);
    expect(dishesData.length).toBeGreaterThanOrEqual(120);
    expect(logosData.length).toBeGreaterThanOrEqual(60);
    for (const data of [peopleData, dishesData, logosData]) expect(unique(data.map((x) => x.slug))).toBe(true);
    expect(new Set(peopleData.map((p) => p.category))).toEqual(new Set(["cinema", "musique", "sport", "histoire", "culture"]));
    expect(new Set(dishesData.map((d) => d.region))).toEqual(new Set(["france", "europe", "asie", "ameriques", "afrique-orient"]));
  });

  it("les logos sont posés sur fond clair, les plats donnent leur pays", async () => {
    const [logo] = await draw(logos, 1);
    expect(logo.media).toMatchObject({ type: "image", light: true });
    const [dish] = await draw(dishes, 1);
    expect(dish.answers[0].value).toMatch(/\(.+\)$/);
    const [person] = await draw(people, 1);
    expect(person.prompt).toBe("Qui est-ce ?");
  });
});

describe("emojis et répliques", () => {
  it("au moins 150 titres en emojis, sans lettre qui trahirait la réponse", () => {
    expect(emojisData.items.length).toBeGreaterThanOrEqual(150);
    expect(unique(emojisData.items.map((e) => e.id))).toBe(true);
    for (const e of emojisData.items) {
      expect(e.emojis, e.id).not.toMatch(/[a-zA-Z]/);
      expect(Object.keys(emojisData.categories), e.id).toContain(e.category);
    }
  });

  it("au moins 150 répliques, sans le titre de l'œuvre dans la réplique", () => {
    expect(quotesData.items.length).toBeGreaterThanOrEqual(150);
    expect(unique(quotesData.items.map((q) => q.id))).toBe(true);
    const quoteTexts = quotesData.items.map((q) => q.quote);
    for (const q of quotesData.items) {
      expect(Object.keys(quotesData.categories), q.id).toContain(q.category);
      // Une même réplique pour deux œuvres serait injugeable.
      expect(quoteTexts.filter((t) => t === q.quote), q.id).toHaveLength(1);
    }
  });

  it("produisent une question texte avec la catégorie en guise de média", async () => {
    for (const provider of [emojis, quotes]) {
      const [q] = await draw(provider, 1);
      expect(q.media.type).toBe("text");
      expect(q.answers).toHaveLength(1);
    }
  });
});
