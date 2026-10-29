// Pool jeux vidéo : jeux principaux connus, d'après IGDB.
import { IgdbClient } from "../../server/igdb.ts";
import type { Game } from "../../src/data/games.ts";
import { writeJson } from "./http.ts";

/** Nombre minimal de notes IGDB (total_rating_count). 400 → ~450 jeux. */
export const MIN_RATING_COUNT = 400;
/** game_type IGDB : 0 = jeu principal, 8 = remake. Exclus : DLC, extensions, portages, remasters, bundles… */
const GAME_TYPES = [0, 8];
/** IGDB plafonne `limit` à 500. */
const PAGE = 500;

interface IgdbGame {
  id: number;
  name: string;
  total_rating_count: number;
  first_release_date?: number;
  cover?: { image_id: string };
  screenshots?: { image_id: string }[];
}

export async function buildGames(): Promise<void> {
  const igdb = IgdbClient.fromEnv();
  const raw: IgdbGame[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await igdb.query<IgdbGame[]>(
      "games",
      `fields name,total_rating_count,first_release_date,cover.image_id,screenshots.image_id;
       where total_rating_count >= ${MIN_RATING_COUNT} & game_type = (${GAME_TYPES.join(",")}) & version_parent = null;
       sort total_rating_count desc; limit ${PAGE}; offset ${offset};`,
    );
    raw.push(...page);
    if (page.length < PAGE) break;
  }

  // Un remake porte souvent le même nom que l'original (Resident Evil 2) : on garde le plus noté.
  const byName = new Map<string, IgdbGame>();
  for (const g of raw) {
    const key = g.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const current = byName.get(key);
    if (!current || g.total_rating_count > current.total_rating_count) byName.set(key, g);
  }
  const games: Game[] = [...byName.values()].map((g) => ({
    id: g.id,
    name: g.name,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
    ratings: g.total_rating_count,
    cover: g.cover?.image_id ?? null,
    screenshots: (g.screenshots ?? []).map((s) => s.image_id),
  }));

  await writeJson("data/games.json", games);
  const withCover = games.filter((g) => g.cover).length;
  const withShots = games.filter((g) => g.screenshots.length).length;
  console.log(`  ${raw.length} jeux IGDB (≥ ${MIN_RATING_COUNT} notes) → ${games.length} après dédoublonnage par nom`);
  console.log(`  ${withCover} avec jaquette, ${withShots} avec screenshots`);
}
