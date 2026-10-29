// Construit les pools de questions stables dans data/*.json.
// Usage : npm run build-pools [-- countries shapes music games films series ost film-music series-music]   (sans argument : tout)
import { readFile } from "node:fs/promises";
import { loadEnv } from "../server/env.ts";
import type { Country } from "../src/data/countries.ts";
import { buildCountries } from "./pools/countries.ts";
import { buildGames } from "./pools/games.ts";
import { buildMusic } from "./pools/music.ts";
import { buildSoundtracks, SOUNDTRACK_POOLS } from "./pools/ost.ts";
import { buildShapes } from "./pools/shapes.ts";
import { buildScreen } from "./pools/tmdb.ts";

loadEnv();
const requested = new Set(process.argv.slice(2));
const wants = (name: string) => requested.size === 0 || requested.has(name);

let countries: Country[] | null = null;
if (wants("countries")) {
  console.log("Pays et capitales…");
  countries = await buildCountries();
}
if (wants("shapes")) {
  console.log("Silhouettes des pays…");
  countries ??= JSON.parse(await readFile("data/countries.json", "utf8")) as Country[];
  await buildShapes(countries);
}
if (wants("music")) {
  console.log("Musique (Deezer)…");
  await buildMusic();
}
if (wants("games")) {
  console.log("Jeux vidéo (IGDB)…");
  await buildGames();
}
if (wants("films")) {
  console.log("Films (TMDB)…");
  await buildScreen("movie");
}
if (wants("series")) {
  console.log("Séries (TMDB)…");
  await buildScreen("tv");
}
for (const [name, pool] of Object.entries(SOUNDTRACK_POOLS)) {
  if (!wants(name)) continue;
  console.log(`Musique des ${pool.label} (Deezer)…`);
  await buildSoundtracks(pool);
}
console.log("Terminé.");
