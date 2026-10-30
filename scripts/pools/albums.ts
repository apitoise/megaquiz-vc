// Pool « Pochettes d'album » : liste curée (data/albums_curated.json), pochette trouvée sur Deezer.
// Un album n'est retenu que si l'artiste correspond et que le titre commence par celui attendu
// (« Nevermind (Remastered) » convient, pas une compilation « Best of »). `album` impose un id à la main.
import { readFile } from "node:fs/promises";
import type { Album } from "../../src/data/albums.ts";
import { normalize, slugify } from "../../src/data/ost.ts";
import { deezer } from "./deezer.ts";
import { writeJson } from "./http.ts";

interface Curated {
  artist: string;
  album: string;
  /** Album Deezer imposé (contourne la recherche). */
  id?: number;
}

interface DeezerAlbum {
  id: number;
  title: string;
  record_type: string;
  cover_xl: string;
  artist: { name: string };
}

/** Un album Deezer correspond-il à l'entrée curée ? */
export function sameAlbum(curated: Pick<Curated, "artist" | "album">, found: Pick<DeezerAlbum, "title" | "artist">): boolean {
  const title = normalize(found.title);
  const wanted = normalize(curated.album);
  // Titre tout en symboles (« ÷ », « & ») : rien à comparer, l'artiste suffit.
  const titleOk = wanted === "" ? title === "" || found.title.trim().startsWith(curated.album) : title === wanted || title.startsWith(`${wanted} `);
  return titleOk && normalize(found.artist.name) === normalize(curated.artist);
}

export async function buildAlbums(): Promise<void> {
  const curated = JSON.parse(await readFile("data/albums_curated.json", "utf8")) as Curated[];
  const albums: Album[] = [];
  const absent: string[] = [];
  for (const c of curated) {
    const found = c.id
      ? await deezer<DeezerAlbum>(`/album/${c.id}`)
      : (await deezer<{ data: DeezerAlbum[] }>("/search/album", { q: `${c.artist} ${c.album}`, limit: 25 })).data.find((a) => sameAlbum(c, a));
    if (!found?.cover_xl) {
      absent.push(`${c.artist} — ${c.album}`);
      continue;
    }
    albums.push({ slug: slugify(`${c.artist} ${c.album}`) || `deezer-${found.id}`, title: c.album, artist: c.artist, cover: found.cover_xl });
  }
  await writeJson("data/albums.json", albums);
  console.log(`  ${albums.length}/${curated.length} albums retenus`);
  for (const a of absent) console.log(`    absent  ${a}`);
}
