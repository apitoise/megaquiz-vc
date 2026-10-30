/** Carte du monde (data/world_map.json, générée par `npm run build-pools -- world-map`). */
export interface WorldMap {
  width: number;
  height: number;
  /** Tous les pays (frontières comprises), en un seul chemin SVG. */
  background: string;
  /** Par code ISO alpha-2 : tracé du pays (territoires éloignés exclus) et cadre [x0, y0, x1, y1] en pixels. */
  countries: Record<string, { path: string; box: [number, number, number, number] }>;
}

/** Largeur de la carte projetée, en pixels (viewBox). */
export const WORLD_MAP_WIDTH = 2000;

/** Proportions de la vue zoomée (celles d'un écran 16:10). */
const VIEW_RATIO = 1.6;
/** La vue montre au moins ce multiple de la taille du pays, pour voir ses voisins. */
const CONTEXT = 3.5;
/** Largeur minimale de la vue : même un tout petit pays est montré dans sa région. */
const MIN_VIEW_WIDTH = 260;
/** Un pays plus petit que ça (px, plus grand côté) reçoit en plus un cercle pour être repéré. */
const SMALL_COUNTRY_PX = 14;

/** Vue [x, y, largeur, hauteur] centrée sur un cadre, à l'intérieur de la carte autant que possible. */
export function viewAround(box: [number, number, number, number], map: Pick<WorldMap, "width" | "height">): [number, number, number, number] {
  const [x0, y0, x1, y1] = box;
  const width = Math.min(map.width, Math.max(MIN_VIEW_WIDTH, (x1 - x0) * CONTEXT, (y1 - y0) * CONTEXT * VIEW_RATIO));
  const height = Math.min(map.height, width / VIEW_RATIO);
  const clamp = (start: number, size: number, max: number) => Math.max(0, Math.min(max - size, start));
  const x = clamp((x0 + x1) / 2 - width / 2, width, map.width);
  const y = clamp((y0 + y1) / 2 - height / 2, height, map.height);
  return [x, y, width, height].map((n) => Math.round(n * 10) / 10) as [number, number, number, number];
}

/** SVG de la question : la région autour du pays, le pays surligné (et cerclé s'il est minuscule). */
export function worldMapSvg(map: WorldMap, code: string): string {
  const { path, box } = map.countries[code];
  const view = viewAround(box, map);
  const [x0, y0, x1, y1] = box;
  const circle =
    Math.max(x1 - x0, y1 - y0) < SMALL_COUNTRY_PX
      ? `<circle cx="${(x0 + x1) / 2}" cy="${(y0 + y1) / 2}" r="${Math.round(view[2] * 0.035)}" fill="none" stroke="#ff5c8a" stroke-width="3" vector-effect="non-scaling-stroke"/>`
      : "";
  return (
    `<svg viewBox="${view.join(" ")}" role="img" aria-label="Carte avec un pays surligné">` +
    `<rect x="${view[0]}" y="${view[1]}" width="${view[2]}" height="${view[3]}" fill="#16213a"/>` +
    `<path d="${map.background}" fill="#2b2f45" stroke="#7d8099" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` +
    `<path d="${path}" fill="#ff5c8a" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` +
    circle +
    `</svg>`
  );
}
