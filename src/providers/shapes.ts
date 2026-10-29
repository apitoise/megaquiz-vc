import countriesData from "../../data/countries.json";
import { countryAnswer, SHAPE_SIZE, type Country } from "../data/countries.ts";
import { poolProvider } from "./pool.ts";

/** Pays plus petits que ça (km²) exclus : micro-États et petites îles ne sont pas reconnaissables. */
export const MIN_SHAPE_AREA_KM2 = 5000;

type ShapeCountry = Country & { path: string };

export const shapes = poolProvider<ShapeCountry>({
  id: "shapes",
  label: "Formes des pays",
  async load() {
    // ~700 Ko : chargé seulement si le thème est coché.
    const paths = (await import("../../data/shapes.json")).default as Record<string, string>;
    return (countriesData as Country[])
      .filter((c) => c.area >= MIN_SHAPE_AREA_KM2 && paths[c.code])
      .map((c) => ({ ...c, path: paths[c.code] }));
  },
  key: (c) => c.code,
  toQuestion: (c, id) => ({
    id,
    theme: "shapes",
    prompt: "Quel est ce pays ?",
    media: {
      type: "svg",
      // Le contour de même couleur masque les fines coutures entre polygones voisins.
      src: `<svg viewBox="0 0 ${SHAPE_SIZE} ${SHAPE_SIZE}" role="img" aria-label="Silhouette d'un pays"><path d="${c.path}" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>`,
    },
    answers: [{ label: "Pays", value: countryAnswer(c) }],
  }),
});
