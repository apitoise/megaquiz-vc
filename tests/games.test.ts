import { describe, expect, it, vi } from "vitest";
import gamesData from "../data/games.json";
import { IgdbClient } from "../server/igdb.ts";
import type { Game } from "../src/data/games.ts";
import { covers } from "../src/providers/covers.ts";
import { screenshots } from "../src/providers/screenshots.ts";

const games = gamesData as Game[];

describe("data/games.json", () => {
  it("contient 300 à 500 jeux, sans doublon d'id ni de nom", () => {
    expect(games.length).toBeGreaterThanOrEqual(300);
    expect(games.length).toBeLessThanOrEqual(500);
    expect(new Set(games.map((g) => g.id)).size).toBe(games.length);
    expect(new Set(games.map((g) => g.name.toLowerCase())).size).toBe(games.length);
  });

  it("ne contient que des ids d'images (pas d'URL, pas de secret)", () => {
    const text = JSON.stringify(games);
    expect(text).not.toMatch(/https?:|access_token|client_secret/);
  });
});

describe("thèmes jeux vidéo", () => {
  it("jaquettes : image IGDB en grand format, réponse = nom du jeu", async () => {
    await covers.init();
    const witcher = games.find((g) => g.id === 1942)!;
    const q = await covers.next(new Set(games.filter((g) => g.id !== 1942).map((g) => `covers:${g.id}`)));
    expect(q).toMatchObject({
      id: "covers:1942",
      media: { type: "image", src: `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${witcher.cover}.jpg` },
      answers: [{ label: "Jeu", value: "The Witcher 3: Wild Hunt" }],
    });
  });

  it("screenshots : un screenshot du jeu tiré au hasard", async () => {
    await screenshots.init();
    const witcher = games.find((g) => g.id === 1942)!;
    const exclude = new Set(games.filter((g) => g.id !== 1942).map((g) => `screenshots:${g.id}`));
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) seen.add((await screenshots.next(exclude)).media.src);
    expect(seen.size).toBeGreaterThan(1);
    for (const src of seen) {
      const imageId = src.match(/t_1080p\/(\w+)\.jpg$/)![1];
      expect(witcher.screenshots).toContain(imageId);
    }
  });
});

describe("IgdbClient", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("met le token en cache et envoie les en-têtes IGDB", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) =>
      String(url).startsWith("https://id.twitch.tv") ? json({ access_token: "tok", expires_in: 3600 }) : json([{ id: 1 }]),
    );
    const client = new IgdbClient("cid", "secret", fetchMock as typeof fetch);
    await client.query("games", "fields name;");
    await client.query("games", "fields name;");
    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith("https://id.twitch.tv"));
    expect(tokenCalls).toHaveLength(1);
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(init?.headers).toMatchObject({ "Client-ID": "cid", Authorization: "Bearer tok" });
  });

  it("renouvelle le token sur 401", async () => {
    let tokens = 0;
    let apiCalls = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).startsWith("https://id.twitch.tv")) return json({ access_token: `tok${++tokens}`, expires_in: 3600 });
      return ++apiCalls === 1 ? json({ message: "expired" }, 401) : json([{ id: 1 }]);
    });
    const client = new IgdbClient("cid", "secret", fetchMock as typeof fetch);
    await expect(client.query("games", "fields name;")).resolves.toEqual([{ id: 1 }]);
    expect(tokens).toBe(2);
  });

  it("signale clairement des identifiants absents", () => {
    expect(() => IgdbClient.fromEnv({})).toThrow(/TWITCH_CLIENT_ID/);
  });
});
