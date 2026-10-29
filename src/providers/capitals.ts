import countriesData from "../../data/countries.json";
import { flagUrl, type Country } from "../data/countries.ts";
import { poolProvider } from "./pool.ts";

/**
 * Pays plus petits que ça (km²) écartés : leurs capitales (Palikir, Majuro, Basseterre…) sont
 * introuvables pour presque tout le monde. Exception : l'Europe (Luxembourg, Malte, Monaco…).
 */
export const MIN_CAPITAL_AREA_KM2 = 10_000;

export function hasKnownCapital(c: Country): boolean {
  return c.area >= MIN_CAPITAL_AREA_KM2 || c.region === "Europe";
}

export const capitals = poolProvider<Country>({
  id: "capitals",
  label: "Capitales",
  load: async () => (countriesData as Country[]).filter(hasKnownCapital),
  key: (c) => c.code,
  // Un continent tiré à parts égales, jamais deux fois de suite : l'Afrique (54 pays sur 195)
  // ne domine plus, et les questions varient.
  group: (c) => c.region,
  toQuestion: (c, id) => ({
    id,
    theme: "capitals",
    prompt: `Quelle est la capitale ${c.de} ?`,
    // Le drapeau illustre la question : le pays est déjà nommé, il ne donne pas d'indice.
    media: { type: "image", src: flagUrl(c) },
    answers: [{ label: "Capitale", value: c.capital }],
  }),
});
