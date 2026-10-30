// Construit les pools de questions stables dans data/*.json.
// Usage : npm run build-pools [-- countries shapes world-map music albums games films series art landmarks people dishes logos france juste-prix ost film-music series-music generiques]   (sans argument : tout)
import { readFile } from "node:fs/promises";
import { loadEnv } from "../server/env.ts";
import type { Country } from "../src/data/countries.ts";
import { buildAlbums } from "./pools/albums.ts";
import { buildCountries } from "./pools/countries.ts";
import { buildFrance } from "./pools/france.ts";
import { buildGames } from "./pools/games.ts";
import { buildGeneriques } from "./pools/generiques.ts";
import { buildJustePrix } from "./pools/juste-prix.ts";
import { buildLogos } from "./pools/logos.ts";
import { buildMusic } from "./pools/music.ts";
import { buildSoundtracks, SOUNDTRACK_POOLS } from "./pools/ost.ts";
import { buildShapes } from "./pools/shapes.ts";
import { buildScreen } from "./pools/tmdb.ts";
import { buildArt, buildDishes, buildLandmarks, buildPeople } from "./pools/wiki.ts";
import { buildWorldMap } from "./pools/world-map.ts";

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
if (wants("world-map")) {
  console.log("Carte du monde…");
  countries ??= JSON.parse(await readFile("data/countries.json", "utf8")) as Country[];
  await buildWorldMap(countries);
}
if (wants("music")) {
  console.log("Musique (Deezer)…");
  await buildMusic();
}
if (wants("albums")) {
  console.log("Pochettes d'album (Deezer)…");
  await buildAlbums();
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
if (wants("art")) {
  console.log("Art (Wikipédia / Wikidata)…");
  await buildArt();
}
if (wants("landmarks")) {
  console.log("Monuments et lieux (Wikipédia / Wikidata)…");
  await buildLandmarks();
}
if (wants("people")) {
  console.log("Personnalités (Wikipédia / Wikidata)…");
  await buildPeople();
}
if (wants("dishes")) {
  console.log("Plats du monde (Wikipédia)…");
  await buildDishes();
}
if (wants("logos")) {
  console.log("Logos (Wikidata / Commons)…");
  await buildLogos();
}
if (wants("france")) {
  console.log("Villes de France (API Géo)…");
  await buildFrance();
}
if (wants("juste-prix")) {
  console.log("Le juste prix…");
  await buildJustePrix();
}
for (const [name, pool] of Object.entries(SOUNDTRACK_POOLS)) {
  if (!wants(name)) continue;
  console.log(`Musique des ${pool.label} (Deezer)…`);
  await buildSoundtracks(pool);
}
if (wants("generiques")) {
  console.log("Génériques (Deezer)…");
  await buildGeneriques();
}
console.log("Terminé.");
