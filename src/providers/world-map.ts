import countriesData from "../../data/countries.json";
import { countryAnswer, type Country } from "../data/countries.ts";
import { worldMapSvg, type WorldMap } from "../data/world-map.ts";
import { poolProvider } from "./pool.ts";

let map: WorldMap | null = null;

/** « Pays sur la carte » : la région autour d'un pays surligné (cerclé s'il est minuscule). */
export const worldMap = poolProvider<Country>({
  id: "world-map",
  label: "Pays sur la carte",
  async load() {
    // ~750 Ko : chargé seulement si le thème est coché.
    map = (await import("../../data/world_map.json")).default as unknown as WorldMap;
    return (countriesData as Country[]).filter((c) => map!.countries[c.code]);
  },
  key: (c) => c.code,
  // Un continent tiré à parts égales, jamais deux fois de suite (comme les capitales).
  group: (c) => c.region,
  toQuestion: (c, id) => ({
    id,
    theme: "world-map",
    prompt: "Quel est ce pays ?",
    media: { type: "svg", src: worldMapSvg(map!, c.code), wide: true },
    answers: [{ label: "Pays", value: countryAnswer(c) }],
  }),
});
