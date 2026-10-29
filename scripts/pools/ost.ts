// Pool OST : bandes originales de jeux vidéo trouvées sur Deezer, à partir d'une liste curée.
// Chaque album est validé (titre = nom du jeu + mention d'OST, pas de film/série/reprise),
// et la couverture est mesurée : trouvés, douteux (exclus, à valider à la main), absents (exclus).
import { readFile } from "node:fs/promises";
import { slugify, type OstCandidate, type OstGame } from "../../src/data/ost.ts";
import { judgeAlbums, type AlbumCandidate, type Verdict } from "../../src/music/ost-match.ts";
import { deezer, deezerAll, type DeezerTrack } from "./deezer.ts";
import { writeJson } from "./http.ts";

/** Pistes gardées par album : les plus populaires, donc les thèmes les plus reconnaissables. */
const TRACKS_PER_GAME = 12;
/** Pistes trop courtes (jingles, effets) : inutilisables pour un extrait de 20 s. */
const MIN_TRACK_SECONDS = 45;
/** Au-dessous, l'album ne fournit pas assez de variété. */
const MIN_PLAYABLE_TRACKS = 3;
const QUERIES = ["original soundtrack", "soundtrack", "OST"];

interface DeezerAlbum {
  id: number;
  title: string;
  nb_tracks: number;
  record_type: string;
  artist: { name: string };
}

interface AlbumTrack extends DeezerTrack {
  duration: number;
}

type Coverage = { name: string; status: "ok" | "douteux" | "absent"; album?: string; reason?: string; tracks?: number };

export async function buildOst(): Promise<void> {
  const candidates = JSON.parse(await readFile("data/ost_games.json", "utf8")) as OstCandidate[];
  const games: OstGame[] = [];
  const coverage: Coverage[] = [];

  for (const candidate of candidates) {
    const verdict = candidate.album ? await forcedAlbum(candidate.album) : await searchAlbum(candidate);
    if (verdict.status !== "ok") {
      coverage.push({
        name: candidate.name,
        status: verdict.status,
        ...(verdict.status === "douteux" ? { album: `${verdict.album.title} — ${verdict.album.artist}`, reason: verdict.reason } : {}),
      });
      continue;
    }
    const { album } = verdict;
    const tracks = (await deezerAll<AlbumTrack>(`/album/${album.id}/tracks`))
      .filter((t) => t.readable && t.preview && t.duration >= MIN_TRACK_SECONDS)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, TRACKS_PER_GAME);
    const label = `${album.title} — ${album.artist}`;
    if (tracks.length < MIN_PLAYABLE_TRACKS) {
      coverage.push({ name: candidate.name, status: "douteux", album: label, reason: `${tracks.length} piste(s) jouable(s)` });
      continue;
    }
    games.push({
      slug: slugify(candidate.name),
      name: candidate.name,
      album: { id: album.id, title: album.title, artist: album.artist },
      tracks: tracks.map((t) => t.id),
    });
    coverage.push({ name: candidate.name, status: "ok", album: label, tracks: tracks.length });
  }

  await writeJson("data/ost.json", games);
  await writeJson("data/ost_coverage.json", coverage);
  const count = (status: Coverage["status"]) => coverage.filter((c) => c.status === status);
  console.log(`  ${candidates.length} jeux curés : ${count("ok").length} trouvés, ${count("douteux").length} douteux, ${count("absent").length} absents`);
  for (const c of count("douteux")) console.log(`    douteux  ${c.name} : ${c.album} (${c.reason})`);
  for (const c of count("absent")) console.log(`    absent   ${c.name}`);
}

/** Essaie plusieurs formulations de recherche, jusqu'à trouver un album validé. */
async function searchAlbum(candidate: OstCandidate): Promise<Verdict> {
  const match = candidate.match ?? candidate.name;
  const seen = new Map<number, AlbumCandidate>();
  let best: Verdict = { status: "absent" };
  for (const suffix of QUERIES) {
    const results = await deezer<{ data: DeezerAlbum[] }>("/search/album", {
      q: `${candidate.name} ${suffix}`,
      limit: 25,
    });
    for (const a of results.data) {
      seen.set(a.id, { id: a.id, title: a.title, artist: a.artist.name, nb_tracks: a.nb_tracks, record_type: a.record_type });
    }
    best = judgeAlbums(match, [...seen.values()]);
    if (best.status === "ok") break;
  }
  return best;
}

/** Album imposé dans la liste curée : accepté tel quel. */
async function forcedAlbum(id: number): Promise<Verdict> {
  const a = await deezer<DeezerAlbum>(`/album/${id}`);
  return { status: "ok", album: { id: a.id, title: a.title, artist: a.artist.name, nb_tracks: a.nb_tracks, record_type: a.record_type } };
}
