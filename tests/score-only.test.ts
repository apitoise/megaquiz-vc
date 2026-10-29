import { describe, expect, it } from "vitest";
import filmMusic from "../data/film_music.json";
import seriesMusic from "../data/series_music.json";
import { isComposerTrack, judgeAlbums, type AlbumCandidate } from "../src/music/ost-match.ts";

const album = (id: number, title: string, artist: string, nb_tracks = 20): AlbumCandidate => ({ id, title, artist, nb_tracks, record_type: "album" });

describe("films et séries : bandes originales uniquement", () => {
  it("écarte les compilations de chansons (artiste générique), garde la partition", () => {
    const verdict = judgeAlbums(
      "Stranger Things",
      [album(1, "Stranger Things (Soundtrack from the Netflix Original Series)", "Various Artists"), album(2, "Stranger Things (Original Score)", "Kyle Dixon & Michael Stein")],
      "series",
    );
    expect(verdict.status === "ok" && verdict.album.id).toBe(2);
    expect(judgeAlbums("Top Gun", [album(3, "Top Gun (Original Motion Picture Soundtrack)", "Original Motion Picture Soundtrack")], "film").status).toBe("absent");
  });

  it("préfère l'album de partition à l'album de chansons du même compositeur", () => {
    const verdict = judgeAlbums("Frozen", [album(4, "Frozen (Original Motion Picture Soundtrack)", "Christophe Beck"), album(5, "Frozen (Original Score)", "Christophe Beck")], "film");
    expect(verdict.status === "ok" && verdict.album.id).toBe(5);
  });

  it("les jeux vidéo ne sont pas concernés", () => {
    expect(judgeAlbums("Celeste", [album(6, "Celeste Original Soundtrack", "Various Artists")], "game").status).toBe("ok");
  });

  it("ne garde que les pistes du compositeur crédité", () => {
    expect(isComposerTrack("James Horner", "James Horner")).toBe(true);
    expect(isComposerTrack("Hans Zimmer & Lisa Gerrard", "Hans Zimmer")).toBe(true);
    expect(isComposerTrack("Céline Dion", "James Horner")).toBe(false);
    expect(isComposerTrack("Gavin Greenaway", "Hans Zimmer")).toBe(false);
  });

  it("pools générés : aucun album crédité à un artiste générique", () => {
    for (const w of [...filmMusic, ...seriesMusic]) {
      expect(w.album.artist, w.name).not.toMatch(/various artists|soundtrack|motion picture|cast/i);
    }
  });
});
