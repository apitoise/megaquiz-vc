// Construit les pools de questions stables dans data/*.json.
// Usage : npm run build-pools [-- countries shapes …]   (sans argument : tout)
import { readFile } from "node:fs/promises";
import type { Country } from "../src/data/countries.ts";
import { buildCountries } from "./pools/countries.ts";
import { buildMusic } from "./pools/music.ts";
import { buildShapes } from "./pools/shapes.ts";

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
console.log("Terminé.");
