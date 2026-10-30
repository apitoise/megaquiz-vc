// Pool « Génériques » (dessins animés, séries, émissions) : liste curée (data/generiques_curated.json),
// morceau trouvé sur Deezer. Les génériques y sont publiés sous des artistes très variables
// (interprète d'origine, compilations, « Génériques TV »…) : le titre doit correspondre, l'artiste
// attendu n'est qu'une préférence. Chaque choix est noté dans data/generiques_coverage.json pour
// relecture ; `exclude` (avec sa raison) écarte une entrée jugée fausse à l'écoute.
import { readFile } from "node:fs/promises";
import { normalize, slugify, type Soundtrack } from "../../src/data/ost.ts";
import { cleanTitle } from "../../src/music/clean.ts";
import { deezer, type DeezerTrack } from "./deezer.ts";
import { writeJson } from "./http.ts";

interface Curated {
  /** Réponse affichée. */
  name: string;
  /** Titre du morceau sur Deezer (comparé sans accents ni ponctuation). */
  title: string;
  /** Interprète attendu, préféré quand il est trouvé. */
  artist?: string;
  /** Morceau Deezer imposé à la main. */
  id?: number;
  exclude?: string;
}

interface FullTrack extends DeezerTrack {
  duration: number;
  album: { id: number; title: string };
}

/** Versions à écarter : karaoké, remix, live, reprises dansantes… */
// Bornes explicites : \b ne reconnaît pas la fin de « karaoké » (é n'est pas un caractère de mot pour \b).
const UNWANTED = /(^|[^\p{L}])(karaok[eé]|remix|mix|live|cover|tribute|lullaby|berceuse|rock version|dance version|edit)($|[^\p{L}])/iu;

/** Un morceau Deezer est-il le générique attendu ? */
export function isTheme(curated: Pick<Curated, "title">, track: Pick<FullTrack, "title" | "readable" | "preview">): boolean {
  if (!track.readable || !track.preview || UNWANTED.test(track.title)) return false;
  const title = normalize(cleanTitle(track.title));
  const wanted = normalize(curated.title);
  return title === wanted || title.startsWith(`${wanted} `) || title.includes(` ${wanted} `) || title.endsWith(` ${wanted}`);
}

type Coverage = { name: string; status: "ok" | "absent" | "exclu"; track?: string; reason?: string };

export async function buildGeneriques(): Promise<void> {
  const curated = JSON.parse(await readFile("data/generiques_curated.json", "utf8")) as Curated[];
  const works: Soundtrack[] = [];
  const coverage: Coverage[] = [];
  for (const c of curated) {
    if (c.exclude) {
      coverage.push({ name: c.name, status: "exclu", reason: c.exclude });
      continue;
    }
    const best = c.id ? await deezer<FullTrack>(`/track/${c.id}`) : await search(c);
    if (!best) {
      coverage.push({ name: c.name, status: "absent" });
      continue;
    }
    works.push({ slug: slugify(c.name), name: c.name, album: { id: best.album.id, title: best.album.title, artist: best.artist.name }, tracks: [best.id] });
    coverage.push({ name: c.name, status: "ok", track: `${best.title} — ${best.artist.name} (${best.id})` });
  }
  await writeJson("data/generiques.json", works);
  await writeJson("data/generiques_coverage.json", coverage);
  const absent = coverage.filter((c) => c.status === "absent");
  console.log(`  ${works.length}/${curated.length} génériques retenus`);
  for (const c of absent) console.log(`    absent  ${c.name}`);
}

/** Recherche avec l'interprète, puis sur le seul titre ; l'interprète attendu passe devant, puis la popularité. */
async function search(c: Curated): Promise<FullTrack | undefined> {
  const queries = c.artist ? [`${c.artist} ${c.title}`, c.title] : [c.title];
  for (const q of queries) {
    const results = await deezer<{ data: FullTrack[] }>("/search/track", { q, limit: 40 });
    const matches = results.data.filter((t) => isTheme(c, t));
    if (!matches.length) continue;
    const byArtist = c.artist ? matches.filter((t) => normalize(t.artist.name).includes(normalize(c.artist!))) : [];
    return (byArtist.length ? byArtist : matches).sort((a, b) => b.rank - a.rank)[0];
  }
  return undefined;
}
