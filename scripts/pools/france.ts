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
/** Les villes les plus peuplées de chaque région de métropole : les plus connues, bien réparties. */
const CITIES_PER_REGION = 2;
/**
 * Deux villes plus proches que ça seraient confondues sur la carte : la moins peuplée est écartée,
 * sans la remplacer (l'Île-de-France n'a que Paris, Boulogne-Billancourt s'y superposerait).
 */
const MIN_DISTANCE_KM = 20;
const MIN_STEP_PX = 0.6;

interface Commune {
  nom: string;
  code: string;
  population?: number;
  codeDepartement: string;
  codeRegion: string;
  centre?: { coordinates: [number, number] };
}

type CountriesTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>;

const isMetropole = (dep: string) => /^(\d{2}|2A|2B)$/.test(dep);

export async function buildFrance(): Promise<void> {
  const departments = await fetchJson<{ code: string; nom: string; chefLieu: string }[]>("https://geo.api.gouv.fr/departements?fields=nom,code,chefLieu");
  const communes = await fetchJson<Commune[]>("https://geo.api.gouv.fr/communes?fields=nom,code,centre,population,codeDepartement,codeRegion&format=json");
  const depName = new Map(departments.map((d) => [d.code, d.nom]));

  const candidates = communes
    .filter((c) => c.centre && c.population && isMetropole(c.codeDepartement))
    .sort((a, b) => b.population! - a.population!);
  const kept: Commune[] = [];
  const perRegion = new Map<string, number>();
  for (const c of candidates) {
    const rank = (perRegion.get(c.codeRegion) ?? 0) + 1;
    if (rank > CITIES_PER_REGION) continue;
    perRegion.set(c.codeRegion, rank);
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
  console.log(`  ${cities.length} villes (${perRegion.size} régions), contour ${(map.outline.length / 1024).toFixed(0)} Ko`);
  console.log(`  ${cities.map((c) => c.name).join(", ")}`);
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
