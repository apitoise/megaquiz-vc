import { afterEach, describe, expect, it, vi } from "vitest";
import musicData from "../data/music.json";
import type { Track } from "../src/data/music.ts";
import { cleanTitle } from "../src/music/clean.ts";
import { MAX_START_OFFSET_S, music } from "../src/providers/music.ts";

const tracks = musicData as Track[];

describe("data/music.json", () => {
  it("contient un pool conséquent, sans doublon d'id ni de morceau", () => {
    expect(tracks.length).toBeGreaterThan(1000);
    expect(new Set(tracks.map((t) => t.id)).size).toBe(tracks.length);
    const keys = tracks.map((t) => `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ne stocke pas d'URL d'extrait (elle expire) et a des titres déjà nettoyés", () => {
    for (const t of tracks) {
      expect(Object.keys(t).sort()).toEqual(["artist", "id", "rank", "style", "title"]);
      expect(cleanTitle(t.title)).toBe(t.title);
    }
  });
});

describe("thème musique", () => {
  afterEach(() => void vi.unstubAllGlobals());

  it("récupère une URL fraîche au tirage et produit deux réponses", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const id = Number(url.split("/").pop());
      return new Response(JSON.stringify({ id, preview: `https://cdn.test/${id}.mp3?fresh`, cover: `https://img.test/${id}.jpg` }));
    });
    vi.stubGlobal("fetch", fetchMock);
    await music.init();
    const q = await music.next(new Set());
    const track = tracks.find((t) => `music:${t.id}` === q.id)!;

    expect(fetchMock).toHaveBeenCalledWith(`/api/deezer/track/${track.id}`);
    expect(q.media).toMatchObject({ type: "audio", src: `https://cdn.test/${track.id}.mp3?fresh` });
    expect(q.media.startAt).toBeGreaterThanOrEqual(0);
    expect(q.media.startAt).toBeLessThanOrEqual(MAX_START_OFFSET_S);
    expect(q.revealMedia).toEqual({ type: "image", src: `https://img.test/${track.id}.jpg` });
    expect(q.answers).toEqual([
      { label: "Titre", value: track.title },
      { label: "Artiste", value: track.artist },
    ]);
  });

  it("échoue proprement si le proxy ne trouve pas d'extrait (la partie remplacera la question)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":"no_preview"}', { status: 404 })));
    await music.init();
    await expect(music.next(new Set())).rejects.toThrow(/indisponible/);
  });
});
