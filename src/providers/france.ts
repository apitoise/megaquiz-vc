import type { FranceMap, FrenchCity } from "../data/france.ts";
import { poolProvider } from "./pool.ts";

let map: FranceMap | null = null;

/** Carte muette de la France, un point sur la ville à trouver. */
function mapSvg(city: FrenchCity): string {
  const { size, outline } = map!;
  return (
    `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Carte de France avec une ville marquée">` +
    `<path d="${outline}" fill="#2b2f45" stroke="#9a9cb0" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<circle cx="${city.x}" cy="${city.y}" r="16" fill="#ff5c8a" opacity="0.3"/>` +
    `<circle cx="${city.x}" cy="${city.y}" r="7" fill="#ff5c8a" stroke="#fff" stroke-width="2.5"/>` +
    `</svg>`
  );
}

export const frenchCities = poolProvider<FrenchCity>({
  id: "france-cities",
  label: "Villes de France (carte)",
  async load() {
    map = (await import("../../data/france_map.json")).default as FranceMap;
    return map.cities;
  },
  key: (c) => c.code,
  toQuestion: (c, id) => ({
    id,
    theme: "france-cities",
    prompt: "Quelle est cette ville ?",
    media: { type: "svg", src: mapSvg(c) },
    answers: [{ label: "Ville", value: `${c.name} (${c.department})` }],
  }),
});
