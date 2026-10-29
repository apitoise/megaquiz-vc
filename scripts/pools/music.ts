// Pool musique : tubes populaires, années 60 à aujourd'hui, français et internationaux.
// Sources : chart Deezer + playlists éditoriales Deezer retrouvées par leur titre exact.
import type { Track } from "../../src/data/music.ts";
import { cleanArtist, cleanTitle, trackKey } from "../../src/music/clean.ts";
import { deezerAll, findEditorialPlaylist, type DeezerTrack } from "./deezer.ts";
import { writeJson } from "./http.ts";

/** Popularité Deezer minimale (0 à ~1 000 000). En dessous, le morceau est jugé trop peu connu. */
export const MIN_RANK = 450_000;

const YEARS = Array.from({ length: 2025 - 1970 + 1 }, (_, i) => 1970 + i);

/** Playlists éditoriales, par titre exact. Une playlist introuvable est signalée et ignorée. */
const PLAYLISTS = [
  // Une playlist « Top Hits AAAA » par année (compte Deezer Best Of ; rien avant ~1972).
  ...YEARS.map((y) => `Top Hits ${y}`),
  // International, par décennie et par genre.
  "60s Hits",
  "60s Pop",
  "70s Hits",
  "80s Hits",
  "90s Hits",
  "2000s Hits",
  "2010s Hits",
  "Rock Essentials",
  "60s Rock",
  "Disco Essentials",
  "Hits de l'été",
  // Français.
  "Bleu blanc hits 60",
  "Bleu blanc hits 70",
  "Bleu blanc hits 80",
  "Bleu blanc hits 90",
  "Bleu blanc hits 2000",
  "Bleu blanc hits 2010",
  "Bleu blanc hits 2020",
  "Essentiels variété française",
  "Essentiels chanson française",
  "Rapstars : années 1990",
  "Rapstars : Années 2000",
  "Rapstars : Années 2010",
  "Rapstars : années 2020",
];

export async function buildMusic(): Promise<void> {
  const raw: DeezerTrack[] = await deezerAll<DeezerTrack>("/chart/0/tracks", 100);
  const missing: string[] = [];
  let found = 0;
  for (const title of PLAYLISTS) {
    const playlist = await findEditorialPlaylist(title);
    if (!playlist) {
      missing.push(title);
      continue;
    }
    found++;
    raw.push(...(await deezerAll<DeezerTrack>(`/playlist/${playlist.id}/tracks`)));
  }

  const playable = raw.filter((t) => t.readable && t.preview);
  const popular = playable.filter((t) => t.rank >= MIN_RANK);
  // Dédoublonnage : un même morceau apparaît dans plusieurs albums ; on garde la version la plus populaire.
  const byKey = new Map<string, DeezerTrack>();
  for (const t of popular) {
    const key = trackKey(t.title_short ?? t.title, t.artist.name);
    const current = byKey.get(key);
    if (!current || t.rank > current.rank) byKey.set(key, t);
  }
  const tracks: Track[] = [...byKey.values()]
    .map((t) => ({ id: t.id, title: cleanTitle(t.title_short ?? t.title), artist: cleanArtist(t.artist.name), rank: t.rank }))
    .sort((a, b) => b.rank - a.rank);

  await writeJson("data/music.json", tracks);
  console.log(`  ${found}/${PLAYLISTS.length} playlists éditoriales trouvées + chart`);
  if (missing.length) console.log(`    introuvables : ${missing.join(", ")}`);
  console.log(`  ${raw.length} morceaux bruts → ${playable.length} lisibles → ${popular.length} avec rank ≥ ${MIN_RANK} → ${tracks.length} uniques`);
}
