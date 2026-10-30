// Carte du monde pour « Pays sur la carte » : Natural Earth 50m (world-atlas), projection Natural Earth
// unique pour tout le monde. Un fond (tous les pays, frontières comprises) et, par pays, son tracé
// et son cadre en pixels : le jeu zoome autour du pays surligné, ses voisins donnent le contexte.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { feature, merge } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Country } from "../../src/data/countries.ts";
import { WORLD_MAP_WIDTH, type WorldMap } from "../../src/data/world-map.ts";
import { writeJson } from "./http.ts";
import { mainland, svgPath } from "./shapes.ts";

/** Pays plus petits (km²) écartés : micro-États invisibles même en zoomant. */
export const MIN_MAP_AREA_KM2 = 2000;
/** Simplification du fond (px) : il n'est vu qu'en contexte, un tracé grossier suffit. */
const BACKGROUND_STEP_PX = 1.5;
/**
 * Le pays à trouver est tracé selon la vue zoomée : un pas d'environ 1/120 de sa taille
 * (soit ~2 px à l'écran), entre 0,25 px (Luxembourg, vu de très près) et 3 px (Russie, vue de loin).
 */
const countryStep = (size: number) => Math.min(3, Math.max(0.25, size / 120));

type CountriesTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>;

export async function buildWorldMap(countries: Country[]): Promise<void> {
  const require = createRequire(import.meta.url);
  const topo = JSON.parse(await readFile(require.resolve("world-atlas/countries-50m.json"), "utf8")) as CountriesTopology;
  const all = feature(topo, topo.objects.countries);
  // L'Antarctique occupe tout le bas de la carte sans jamais être demandé.
  const shown = { ...all, features: all.features.filter((f) => f.properties.name !== "Antarctica") };
  const projection = geoNaturalEarth1().fitWidth(WORLD_MAP_WIDTH, shown);
  const [[, top], [, bottom]] = geoPath(projection).bounds(shown);

  const map: WorldMap = { width: WORLD_MAP_WIDTH, height: Math.ceil(bottom - top), background: "", countries: {} };
  projection.translate([projection.translate()[0], projection.translate()[1] - top]);
  map.background = svgPath(projection, shown, BACKGROUND_STEP_PX);

  const report: string[] = [];
  for (const country of countries.filter((c) => c.area >= MIN_MAP_AREA_KM2)) {
    const parts = topo.objects.countries.geometries.filter((g) => g.id === country.ccn3);
    if (!parts.length) {
      report.push(`${country.code} ${country.name} : absent de world-atlas 50m`);
      continue;
    }
    // Territoires éloignés écartés (Guyane pour la France, Alaska…) : le cadre resterait sinon immense.
    const { polygons } = mainland(merge(topo, parts as never) as MultiPolygon);
    const shape: Feature<MultiPolygon> = { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: polygons } };
    let [[x0, y0], [x1, y1]] = geoPath(projection).bounds(shape);
    if (x1 - x0 > map.width / 2) {
      // Pays coupé par l'antiméridien (Fidji) : cadre de sa plus grande île, sinon on verrait le monde entier.
      const largest = polygons
        .map((coordinates): Feature<Polygon> => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates } }))
        .sort((a, b) => geoPath(projection).area(b) - geoPath(projection).area(a))[0];
      const bounds = geoPath(projection).bounds(largest);
      if (bounds[1][0] - bounds[0][0] < map.width / 2) [[x0, y0], [x1, y1]] = bounds;
    }
    const round = (n: number) => Math.round(n * 10) / 10;
    map.countries[country.code] = { path: svgPath(projection, shape, countryStep(Math.max(x1 - x0, y1 - y0))), box: [round(x0), round(y0), round(x1), round(y1)] };
  }

  await writeJson("data/world_map.json", map);
  const bytes = Buffer.byteLength(JSON.stringify(map));
  console.log(`  ${Object.keys(map.countries).length} pays sur la carte, ${(bytes / 1024).toFixed(0)} Ko`);
  for (const line of report) console.log(`    ${line}`);
}
