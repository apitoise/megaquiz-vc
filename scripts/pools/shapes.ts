// Silhouettes des pays : TopoJSON Natural Earth 50m (world-atlas) → chemins SVG pré-calculés.
// Projection azimutale équivalente centrée sur chaque pays : pas de coupure à l'antiméridien
// (Russie, Fidji) et une déformation minimale, même pour les très grands pays.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { geoArea, geoAzimuthalEqualArea, geoCentroid, geoDistance, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { merge } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { SHAPE_SIZE, type Country } from "../../src/data/countries.ts";
import { writeJson } from "./http.ts";

/** Marge intérieure du carré SVG, en pixels. */
const PADDING = 10;
/** Une île plus éloignée que ça du reste du pays est écartée (DOM-TOM, Alaska, Canaries…). */
const MAX_GAP_KM = 500;
/** Les petites îles (< 1 % du pays) doivent être plus proches, sinon elles écrasent le cadrage (Rotuma pour les Fidji). */
const SMALL_PART_RATIO = 0.01;
const SMALL_PART_MAX_GAP_KM = 150;
/** …sauf s'il représente une part majeure du pays (Bornéo pour la Malaisie). */
const MAJOR_PART_RATIO = 0.25;
/** Les îles plus petites que cette fraction de la superficie du pays sont invisibles : on les ignore. */
const MIN_PART_RATIO = 0.0005;
/** Distance minimale entre deux points consécutifs du tracé, en pixels (simplification). */
const MIN_STEP_PX = 0.7;
const EARTH_RADIUS_KM = 6371;

/** Entités séparées dans Natural Earth, rattachées à leur pays (sinon la silhouette est fausse). */
const ATTACH: Record<string, string> = { Somaliland: "706", "N. Cyprus": "196" };

type CountriesTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>;

export async function buildShapes(countries: Country[]): Promise<void> {
  const require = createRequire(import.meta.url);
  const topo = JSON.parse(await readFile(require.resolve("world-atlas/countries-50m.json"), "utf8")) as CountriesTopology;
  const geometries = topo.objects.countries.geometries;

  const shapes: Record<string, string> = {};
  const report: string[] = [];
  for (const country of countries) {
    const parts = geometries.filter((g) => g.id === country.ccn3 || ATTACH[(g.properties as { name?: string } | undefined)?.name ?? ""] === country.ccn3);
    if (!parts.length) {
      report.push(`${country.code} ${country.name} : absent de world-atlas 50m`);
      continue;
    }
    const merged = merge(topo, parts as never) as MultiPolygon;
    const { polygons, dropped } = mainland(merged);
    if (dropped) report.push(`${country.code} ${country.name} : ${dropped} territoire(s) éloigné(s) écarté(s)`);
    shapes[country.code] = toSvgPath({ type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: polygons } });
  }

  await writeJson("data/shapes.json", shapes);
  const bytes = Buffer.byteLength(JSON.stringify(shapes));
  console.log(`  ${Object.keys(shapes).length} silhouettes, ${(bytes / 1024).toFixed(0)} Ko`);
  for (const line of report) console.log(`    ${line}`);
}

/** Garde la partie principale du pays et les îles proches (regroupement de proche en proche). */
export function mainland(geometry: MultiPolygon): { polygons: Position[][][]; dropped: number } {
  const total = geoArea(geometry);
  const parts = geometry.coordinates
    .map((coords) => ({ coords, area: geoArea({ type: "Polygon", coordinates: coords }), sample: sampleRing(coords[0]) }))
    .filter((p) => p.area >= total * MIN_PART_RATIO)
    .sort((a, b) => b.area - a.area);

  const kept = parts.filter((p, i) => i === 0 || p.area >= total * MAJOR_PART_RATIO);
  let rest = parts.filter((p) => !kept.includes(p));
  for (let changed = true; changed; ) {
    changed = false;
    rest = rest.filter((part) => {
      const maxGap = part.area < total * SMALL_PART_RATIO ? SMALL_PART_MAX_GAP_KM : MAX_GAP_KM;
      if (!kept.some((k) => minDistanceKm(k.sample, part.sample) <= maxGap)) return true;
      kept.push(part);
      changed = true;
      return false;
    });
  }
  // On ne compte comme « écartés » que les territoires d'au moins 1 % du pays (le reste est du bruit).
  const dropped = rest.filter((p) => p.area >= total * 0.01).length;
  return { polygons: kept.map((p) => p.coords), dropped };
}

/** Au plus ~150 points d'un anneau, pour estimer les distances sans tout comparer. */
function sampleRing(ring: Position[]): [number, number][] {
  const step = Math.max(1, Math.floor(ring.length / 150));
  return ring.filter((_, i) => i % step === 0).map(([lon, lat]) => [lon, lat]);
}

function minDistanceKm(a: [number, number][], b: [number, number][]): number {
  let min = Infinity;
  for (const p of a) for (const q of b) min = Math.min(min, geoDistance(p, q));
  return min * EARTH_RADIUS_KM;
}

/** Chemin SVG dans un carré SHAPE_SIZE, projection centrée sur le pays, points arrondis et simplifiés. */
export function toSvgPath(country: Feature<Polygon | MultiPolygon>): string {
  const [lon, lat] = geoCentroid(country);
  const projection = geoAzimuthalEqualArea()
    .rotate([-lon, -lat])
    .fitExtent(
      [
        [PADDING, PADDING],
        [SHAPE_SIZE - PADDING, SHAPE_SIZE - PADDING],
      ],
      country,
    );

  return svgPath(projection, country);
}

/** Chemin SVG d'un objet GeoJSON projeté : points arrondis au dixième, simplifiés (pas minimal `minStep` px). */
export function svgPath(projection: GeoProjection, object: GeoPermissibleObjects, minStep = MIN_STEP_PX): string {
  let out = "";
  let last: [number, number] | null = null;
  let ringStart = out.length;
  let ringPoints = 0;
  const fmt = (n: number) => String(Math.round(n * 10) / 10);
  const context = {
    moveTo(x: number, y: number) {
      ringStart = out.length;
      ringPoints = 1;
      out += `M${fmt(x)} ${fmt(y)}`;
      last = [x, y];
    },
    lineTo(x: number, y: number) {
      if (last && Math.hypot(x - last[0], y - last[1]) < minStep) return;
      out += `L${fmt(x)} ${fmt(y)}`;
      last = [x, y];
      ringPoints++;
    },
    closePath() {
      // Anneau réduit à un point ou deux : invisible, on le retire.
      if (ringPoints < 3) out = out.slice(0, ringStart);
      else out += "Z";
      last = null;
    },
    arc() {},
  };
  geoPath(projection, context as never)(object);
  return out;
}
