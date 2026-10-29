// Pools « musique d'œuvres » : bandes originales de jeux, de films et de séries trouvées sur Deezer,
// à partir de listes curées. Chaque album est validé (titre = nom de l'œuvre + mention d'OST, pas
// de reprise ni d'œuvre d'un autre type), et la couverture est mesurée : trouvés, douteux (exclus,
// à valider à la main), absents (exclus). Les séries peuvent aussi viser un générique précis.
import { readFile } from "node:fs/promises";
import { normalize, slugify, type Soundtrack, type SoundtrackCandidate } from "../../src/data/ost.ts";
import { cleanTitle } from "../../src/music/clean.ts";
import { isComposerTrack, judgeAlbums, SCORE_ONLY, type AlbumCandidate, type SoundtrackKind, type Verdict } from "../../src/music/ost-match.ts";
import { deezer, deezerAll, type DeezerTrack } from "./deezer.ts";
import { writeJson } from "./http.ts";

/** Pistes gardées par album : les plus populaires, donc les thèmes les plus reconnaissables. */
const TRACKS_PER_WORK = 12;
/** Pistes trop courtes (jingles, effets) : inutilisables pour un extrait de 20 s. */
const MIN_TRACK_SECONDS = 45;
/** Au-dessous, l'album ne fournit pas assez de variété (une série peut se réduire à son générique). */
const MIN_PLAYABLE_TRACKS: Record<SoundtrackKind, number> = { game: 3, film: 3, series: 1 };
const QUERIES = ["original soundtrack", "soundtrack", "OST"];

export interface SoundtrackPool {
  kind: SoundtrackKind;
  input: string;
  output: string;
  coverage: string;
  /** « jeux », « films », « séries » (pour le rapport). */
  label: string;
}

export const SOUNDTRACK_POOLS: Record<string, SoundtrackPool> = {
  ost: { kind: "game", input: "data/ost_games.json", output: "data/ost.json", coverage: "data/ost_coverage.json", label: "jeux" },
  "film-music": { kind: "film", input: "data/ost_films.json", output: "data/film_music.json", coverage: "data/film_music_coverage.json", label: "films" },
  "series-music": {
    kind: "series",
    input: "data/ost_series.json",
    output: "data/series_music.json",
    coverage: "data/series_music_coverage.json",
    label: "séries",
  },
};

interface DeezerAlbum {
  id: number;
  title: string;
  nb_tracks: number;
  record_type: string;
  artist: { name: string };
}

interface FullTrack extends DeezerTrack {
  duration: number;
  album: { id: number; title: string };
}

/** albumId : pour valider un « douteux » à la main (champ `album` de la liste curée). */
type Coverage = { name: string; status: "ok" | "douteux" | "absent"; album?: string; albumId?: number; reason?: string; tracks?: number };

export async function buildSoundtracks(pool: SoundtrackPool): Promise<void> {
  const candidates = JSON.parse(await readFile(pool.input, "utf8")) as SoundtrackCandidate[];
  const works: Soundtrack[] = [];
  const coverage: Coverage[] = [];

  for (const candidate of candidates) {
    const found = candidate.track ? await themeTrack(candidate) : await albumTracks(candidate, pool.kind);
    if ("status" in found) {
      coverage.push({ name: candidate.name, ...found });
      continue;
    }
    const { album, tracks } = found;
    const label = `${album.title} — ${album.artist}`;
    if (tracks.length < MIN_PLAYABLE_TRACKS[pool.kind]) {
      coverage.push({ name: candidate.name, status: "douteux", album: label, albumId: album.id, reason: `${tracks.length} piste(s) jouable(s)` });
      continue;
    }
    works.push({ slug: slugify(candidate.name), name: candidate.name, album, tracks });
    coverage.push({ name: candidate.name, status: "ok", album: label, albumId: album.id, tracks: tracks.length });
  }

  await writeJson(pool.output, works);
  await writeJson(pool.coverage, coverage);
  const count = (status: Coverage["status"]) => coverage.filter((c) => c.status === status);
  console.log(`  ${candidates.length} ${pool.label} curés : ${count("ok").length} trouvés, ${count("douteux").length} douteux, ${count("absent").length} absents`);
  for (const c of count("douteux")) console.log(`    douteux  ${c.name} : ${c.album} (${c.reason})`);
  for (const c of count("absent")) console.log(`    absent   ${c.name}`);
}

type Found = { album: Soundtrack["album"]; tracks: number[] } | Omit<Coverage, "name">;

/** Album d'OST validé et ses pistes les plus populaires. */
async function albumTracks(candidate: SoundtrackCandidate, kind: SoundtrackKind): Promise<Found> {
  const verdict = candidate.album ? await forcedAlbum(candidate.album) : await searchAlbum(candidate, kind);
  if (verdict.status === "absent") return { status: "absent" };
  if (verdict.status === "douteux") {
    return { status: "douteux", album: `${verdict.album.title} — ${verdict.album.artist}`, albumId: verdict.album.id, reason: verdict.reason };
  }
  const { album } = verdict;
  const tracks = (await deezerAll<FullTrack>(`/album/${album.id}/tracks`))
    .filter((t) => t.readable && t.preview && t.duration >= MIN_TRACK_SECONDS)
    .filter((t) => !SCORE_ONLY[kind] || isComposerTrack(t.artist.name, album.artist))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, TRACKS_PER_WORK);
  return { album: { id: album.id, title: album.title, artist: album.artist }, tracks: tracks.map((t) => t.id) };
}

/**
 * Générique précis (artiste + titre). La recherche avancée de Deezer (artist:"…" track:"…") ne renvoie
 * plus rien : recherche simple, puis on ne garde que le bon artiste et le titre exact (pas les remixes).
 */
async function themeTrack(candidate: SoundtrackCandidate): Promise<Found> {
  const { artist, title } = candidate.track!;
  const results = await deezer<{ data: FullTrack[] }>("/search/track", { q: `${artist} ${title}`, limit: 25 });
  const byArtist = results.data.filter((t) => t.readable && t.preview && normalize(t.artist.name).includes(normalize(artist)));
  const exact = byArtist.filter((t) => normalize(cleanTitle(t.title)) === normalize(title));
  const matches = (exact.length ? exact : byArtist.filter((t) => normalize(cleanTitle(t.title)).startsWith(normalize(title)))).sort(
    (a, b) => b.rank - a.rank,
  );
  const best = matches[0];
  if (!best) return { status: "absent", reason: `aucun « ${title} » de ${artist}` };
  return { album: { id: best.album.id, title: best.album.title, artist: best.artist.name }, tracks: matches.slice(0, 3).map((t) => t.id) };
}

/** Essaie plusieurs formulations de recherche, jusqu'à trouver un album validé. */
async function searchAlbum(candidate: SoundtrackCandidate, kind: SoundtrackKind): Promise<Verdict> {
  const match = candidate.match ?? candidate.name;
  const seen = new Map<number, AlbumCandidate>();
  let best: Verdict = { status: "absent" };
  for (const suffix of QUERIES) {
    const results = await deezer<{ data: DeezerAlbum[] }>("/search/album", { q: `${match} ${suffix}`, limit: 25 });
    for (const a of results.data) {
      seen.set(a.id, { id: a.id, title: a.title, artist: a.artist.name, nb_tracks: a.nb_tracks, record_type: a.record_type });
    }
    best = judgeAlbums(match, [...seen.values()], kind);
    if (best.status === "ok") break;
  }
  return best;
}

/** Album imposé dans la liste curée : accepté tel quel. */
async function forcedAlbum(id: number): Promise<Verdict> {
  const a = await deezer<DeezerAlbum>(`/album/${id}`);
  return { status: "ok", album: { id: a.id, title: a.title, artist: a.artist.name, nb_tracks: a.nb_tracks, record_type: a.record_type } };
}
