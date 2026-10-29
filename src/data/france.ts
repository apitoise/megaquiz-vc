/** Carte de France pré-projetée (data/france_map.json) et villes à placer dessus. */
export interface FranceMap {
  /** Côté du carré SVG (viewBox). */
  size: number;
  /** Contour de la métropole et de la Corse (chemin SVG). */
  outline: string;
  cities: FrenchCity[];
}

export interface FrenchCity {
  /** Code INSEE de la commune. */
  code: string;
  name: string;
  department: string;
  population: number;
  /** Position projetée sur la carte. */
  x: number;
  y: number;
}
