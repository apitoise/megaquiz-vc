import { afterEach, describe, expect, it, vi } from "vitest";
import ostData from "../data/ost.json";
import type { Soundtrack } from "../src/data/ost.ts";
import { judgeAlbums, residue, type AlbumCandidate } from "../src/music/ost-match.ts";
import { ost } from "../src/providers/ost.ts";

const album = (title: string, nb_tracks = 30, record_type = "album", artist = "X"): AlbumCandidate => ({
  id: Math.floor(Math.random() * 1e9),
  title,
  artist,
  nb_tracks,
  record_type,
});

describe("residue", () => {
  it("vaut une chaîne vide quand le titre n'est que le jeu + des mots d'OST", () => {
    expect(residue("The Elder Scrolls V: Skyrim (Original Game Soundtrack)", "The Elder Scrolls V: Skyrim")).toBe("");
    expect(residue("FINAL FANTASY VII Original Soundtrack", "Final Fantasy VII")).toBe("");
    expect(residue("NieR:Automata Original Soundtrack", "NieR: Automata")).toBe("");
  });

  it("garde ce qui distingue un autre épisode", () => {
    expect(residue("FINAL FANTASY VII REMAKE Original Soundtrack", "Final Fantasy VII")).toBe("remake");
  });

  it("renvoie null si le nom du jeu n'apparaît pas tel quel", () => {
    expect(residue("Beyond Skyrim: Bruma (Original Game Soundtrack)", "The Elder Scrolls V: Skyrim")).toBeNull();
    expect(residue("Halo 3: ODST (Original Soundtrack)", "Halo 2")).toBeNull();
  });
});

describe("judgeAlbums", () => {
  it("choisit l'OST exacte plutôt qu'un autre épisode", () => {
    const verdict = judgeAlbums("Final Fantasy VII", [
      album("FINAL FANTASY VII REMAKE Original Soundtrack", 156),
      album("FINAL FANTASY VII Original Soundtrack", 85),
    ]);
    expect(verdict).toMatchObject({ status: "ok", album: { title: "FINAL FANTASY VII Original Soundtrack" } });
  });

  it("écarte films, séries et reprises", () => {
    expect(
      judgeAlbums("The Witcher 3: Wild Hunt", [
        album("The Witcher 3: Wild Hunt (Original Game Soundtrack) (Live at Video Game Show 2016)"),
        album("Music Box Classics: The Witcher 3: Wild Hunt"),
      ]),
    ).toEqual({ status: "absent" });
    expect(judgeAlbums("Super Mario Bros", [album("The Super Mario Bros. Movie (Original Motion Picture Soundtrack)")])).toEqual({
      status: "absent",
    });
  });

  it("classe en douteux un titre sans mention d'OST ou un single", () => {
    expect(judgeAlbums("Kingdom Hearts", [album("Kingdom Hearts")]).status).toBe("douteux");
    expect(judgeAlbums("Celeste", [album("Celeste (Original Soundtrack)", 1, "single")]).status).toBe("douteux");
  });

  it("accepte « Original Sound Track » en deux mots", () => {
    expect(judgeAlbums("Elden Ring", [album("ELDEN RING ORIGINAL SOUND TRACK", 60)]).status).toBe("ok");
  });
});

describe("data/ost.json", () => {
  const games = ostData as Soundtrack[];

  it("contient les jeux validés, sans doublon, avec au moins 3 pistes", () => {
    expect(games.length).toBeGreaterThanOrEqual(50);
    expect(new Set(games.map((g) => g.slug)).size).toBe(games.length);
    for (const g of games) expect(g.tracks.length, g.name).toBeGreaterThanOrEqual(3);
  });
});

describe("thème OST", () => {
  afterEach(() => void vi.unstubAllGlobals());

  it("une piste au hasard du jeu, URL fraîche, un seul jugement", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const id = Number(url.split("/").pop());
        return new Response(JSON.stringify({ id, preview: `https://cdn.test/${id}.mp3`, cover: null }));
      }),
    );
    await ost.init();
    const q = await ost.next(new Set());
    const game = (ostData as Soundtrack[]).find((g) => `ost:${g.slug}` === q.id)!;
    expect(game.tracks.map((t) => `https://cdn.test/${t}.mp3`)).toContain(q.media.src);
    expect(q.answers).toEqual([{ label: "Jeu", value: game.name }]);
    expect(q.revealMedia).toBeUndefined();
  });

  it("essaie une autre piste si un extrait est indisponible", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => (++calls === 1 ? new Response("{}", { status: 404 }) : new Response(JSON.stringify({ id: 1, preview: "https://cdn.test/ok.mp3", cover: null })))),
    );
    await ost.init();
    const q = await ost.next(new Set());
    expect(q.media.src).toBe("https://cdn.test/ok.mp3");
    expect(calls).toBe(2);
  });
});
