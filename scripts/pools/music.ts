// Pool musique : tubes populaires, années 60 à aujourd'hui, français et internationaux, répartis par style.
// Sources : chart Deezer + playlists éditoriales Deezer retrouvées par leur titre exact.
// Chaque morceau reçoit le style de la première playlist (dans l'ordre de STYLES) qui le contient :
// en partie, le tirage choisit d'abord un style à parts égales, puis un morceau.
import type { Track } from "../../src/data/music.ts";
import { cleanArtist, cleanTitle, trackKey } from "../../src/music/clean.ts";
import { deezerAll, findEditorialPlaylist, type DeezerTrack } from "./deezer.ts";
import { writeJson } from "./http.ts";

/** Popularité Deezer minimale (0 à ~1 000 000). En dessous, le morceau est jugé trop peu connu. */
export const MIN_RANK = 450_000;

const years = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `Top Hits ${from + i}`);

interface Style {
  id: string;
  /** Playlists éditoriales, par titre exact (introuvable : signalée et ignorée). */
  playlists: string[];
  /** Inclut le chart Deezer du moment. */
  chart?: boolean;
}

/**
 * Ordre = priorité : un morceau présent dans « Rock Essentials » et « Top Hits 1985 » est classé rock.
 * Écartés après essai : jazz-blues et reggae-latino (playlists de spécialistes, peu de titres connus
 * du grand public — leurs vrais tubes sont déjà dans « retro » / « tubes »), et les playlists
 * « du moment » (Global Dance Hits, Latin Pop, Les Variétés françaises) pleines d'inconnus.
 */
const STYLES: Style[] = [
  { id: "rap", playlists: ["Rapstars : années 1990", "Rapstars : Années 2000", "Rapstars : Années 2010", "Rapstars : années 2020"] },
  {
    id: "rock",
    playlists: [
      "Rock Essentials",
      "60s Rock",
      "70s Rock",
      "80s Rock",
      "90s Rock",
      "Hard Rock Essentials",
      "Grunge Essentials",
      "Punk Essentials",
      "Modern Rock Essentials",
      "New Wave Essentials",
      "Essentiels rock français",
      "Metal Essentials",
      "Nu Metal Essentials",
    ],
  },
  { id: "dance", playlists: ["90s Dance", "Eurodance", "Electronic Hits", "80s Club Hits"] },
  { id: "soul", playlists: ["Disco Essentials", "Funk Essentials", "Soul Essentials", "R&B Essentials"] },
  {
    id: "variete",
    playlists: [
      "Bleu blanc hits 60",
      "Bleu blanc hits 70",
      "Bleu blanc hits 80",
      "Bleu blanc hits 90",
      "Bleu blanc hits 2000",
      "Bleu blanc hits 2010",
      "Bleu blanc hits 2020",
      "Essentiels variété française",
      "Essentiels chanson française",
    ],
  },
  { id: "retro", playlists: ["60s Hits", "60s Pop", "70s Hits", ...years(1970, 1979)] },
  {
    id: "tubes",
    playlists: [...years(1980, 2025), "80s Hits", "90s Hits", "00s Pop", "Hits de l'été", "Boy Band Essentials", "Divas Essentials"],
    chart: true,
  },
];

export async function buildMusic(): Promise<void> {
  const styleOf = new Map<number, string>();
  const candidates: (DeezerTrack & { style: string })[] = [];
  const missing: string[] = [];
  let found = 0;

  for (const style of STYLES) {
    const raw: DeezerTrack[] = style.chart ? await deezerAll<DeezerTrack>("/chart/0/tracks", 100) : [];
    for (const title of style.playlists) {
      const playlist = await findEditorialPlaylist(title);
      if (!playlist) {
        missing.push(title);
        continue;
      }
      found++;
      raw.push(...(await deezerAll<DeezerTrack>(`/playlist/${playlist.id}/tracks`)));
    }
    for (const t of raw) {
      if (styleOf.has(t.id)) continue; // déjà classé dans un style prioritaire
      styleOf.set(t.id, style.id);
      if (t.readable && t.preview && t.rank >= MIN_RANK) candidates.push({ ...t, style: style.id });
    }
  }

  // Dédoublonnage : un même morceau apparaît dans plusieurs albums ; on garde la version la plus
  // populaire, avec le style de sa première apparition (le plus prioritaire).
  const byKey = new Map<string, DeezerTrack & { style: string }>();
  for (const t of candidates) {
    const key = trackKey(t.title_short ?? t.title, t.artist.name);
    const current = byKey.get(key);
    if (!current) byKey.set(key, t);
    else if (t.rank > current.rank) byKey.set(key, { ...t, style: current.style });
  }
  const tracks: Track[] = [...byKey.values()]
    .map((t) => ({ id: t.id, title: cleanTitle(t.title_short ?? t.title), artist: cleanArtist(t.artist.name), rank: t.rank, style: t.style }))
    .sort((a, b) => b.rank - a.rank);

  await writeJson("data/music.json", tracks);
  const total = STYLES.reduce((n, s) => n + s.playlists.length, 0);
  console.log(`  ${found}/${total} playlists éditoriales trouvées + chart`);
  if (missing.length) console.log(`    introuvables : ${missing.join(", ")}`);
  console.log(`  ${tracks.length} morceaux uniques :`);
  for (const style of STYLES) console.log(`    ${style.id.padEnd(14)} ${tracks.filter((t) => t.style === style.id).length}`);
}
