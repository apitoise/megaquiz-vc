// Villes de France sur une carte muette : contour de la métropole (world-atlas, Natural Earth 10m)
// projeté en conique conforme (type Lambert 93), villes et coordonnées de l'API Géo officielle
// (geo.api.gouv.fr, sans clé). Points et contour sont pré-calculés : rien à projeter en partie.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { geoConicConformal, geoDistance, geoPath } from "d3-geo";
import type { Feature, MultiPolygon } from "geojson";
import { merge } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { FranceMap, FrenchCity } from "../../src/data/france.ts";
import { fetchJson, writeJson } from "./http.ts";

const SIZE = 600;
const PADDING = 24;
/** Préfectures plus petites écartées (Privas, Foix, Mende… trop peu connues). */
const MIN_PREFECTURE_POPULATION = 20_000;
/** Autres villes retenues au-delà de ce seuil (Reims, Le Havre, Brest…). */
const MIN_CITY_POPULATION = 60_000;
/** Deux villes plus proches que ça seraient confondues sur la carte : on garde la plus peuplée. */
const MIN_DISTANCE_KM = 20;
/** Île-de-France hors Paris : tout se superpose à Paris à cette échelle. */
const EXCLUDED_DEPARTMENTS = new Set(["77", "78", "91", "92", "93", "94", "95"]);
const MIN_STEP_PX = 0.6;

interface Commune {
  nom: string;
  code: string;
  population?: number;
  codeDepartement: string;
  centre?: { coordinates: [number, number] };
}

type CountriesTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>;

const isMetropole = (dep: string) => /^(\d{2}|2A|2B)$/.test(dep);

export async function buildFrance(): Promise<void> {
  const departments = await fetchJson<{ code: string; nom: string; chefLieu: string }[]>("https://geo.api.gouv.fr/departements?fields=nom,code,chefLieu");
  const communes = await fetchJson<Commune[]>("https://geo.api.gouv.fr/communes?fields=nom,code,centre,population,codeDepartement&format=json");
  const depName = new Map(departments.map((d) => [d.code, d.nom]));
  const prefectures = new Set(departments.map((d) => d.chefLieu));

  const candidates = communes
    .filter((c) => c.centre && c.population && isMetropole(c.codeDepartement) && !EXCLUDED_DEPARTMENTS.has(c.codeDepartement))
    .filter((c) => c.population! >= (prefectures.has(c.code) ? MIN_PREFECTURE_POPULATION : MIN_CITY_POPULATION))
    .sort((a, b) => b.population! - a.population!);
  const kept: Commune[] = [];
  for (const c of candidates) {
    const near = kept.some((k) => geoDistance(k.centre!.coordinates, c.centre!.coordinates) * 6371 < MIN_DISTANCE_KM);
    if (!near) kept.push(c);
  }

  // Contour : polygones de la France situés en métropole (DOM et TOM écartés par leur position).
  const require = createRequire(import.meta.url);
  const topo = JSON.parse(await readFile(require.resolve("world-atlas/countries-10m.json"), "utf8")) as CountriesTopology;
  const france = merge(topo, topo.objects.countries.geometries.filter((g) => g.id === "250") as never) as MultiPolygon;
  const mainland: Feature<MultiPolygon> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiPolygon",
      coordinates: france.coordinates.filter(([ring]) => ring.every(([lon, lat]) => lon > -6 && lon < 10 && lat > 41 && lat < 52)),
    },
  };
  const projection = geoConicConformal()
    .parallels([44, 49])
    .rotate([-3, 0])
    .fitExtent(
      [
        [PADDING, PADDING],
        [SIZE - PADDING, SIZE - PADDING],
      ],
      mainland,
    );

  const cities: FrenchCity[] = kept.map((c) => {
    const [x, y] = projection(c.centre!.coordinates)!;
    return { code: c.code, name: c.nom, department: depName.get(c.codeDepartement) ?? c.codeDepartement, population: c.population!, x: round(x), y: round(y) };
  });
  const map: FranceMap = { size: SIZE, outline: svgPath(mainland, projection), cities };
  await writeJson("data/france_map.json", map);
  console.log(`  ${cities.length} villes (${cities.filter((c) => prefectures.has(c.code)).length} préfectures), contour ${(map.outline.length / 1024).toFixed(0)} Ko`);
}

const round = (n: number) => Math.round(n * 10) / 10;

function svgPath(feature: Feature<MultiPolygon>, projection: ReturnType<typeof geoConicConformal>): string {
  let out = "";
  let last: [number, number] | null = null;
  const context = {
    moveTo(x: number, y: number) {
      out += `M${round(x)} ${round(y)}`;
      last = [x, y];
    },
    lineTo(x: number, y: number) {
      if (last && Math.hypot(x - last[0], y - last[1]) < MIN_STEP_PX) return;
      out += `L${round(x)} ${round(y)}`;
      last = [x, y];
    },
    closePath() {
      out += "Z";
      last = null;
    },
    arc() {},
  };
  geoPath(projection, context as never)(feature);
  return out;
}
