/** Un pays du pool (data/countries.json, généré par `npm run build-pools`). */
export interface Country {
  /** Code ISO 3166-1 alpha-2, en majuscules. */
  code: string;
  /** Code ISO 3166-1 numérique (identifiant dans world-atlas). */
  ccn3: string;
  name: string;
  /** Autre nom courant, affiché entre parenthèses à la révélation. */
  aka?: string;
  /** Complément « de… » : « de la France », « du Japon », « des Pays-Bas »… */
  de: string;
  capital: string;
  /** Superficie en km². */
  area: number;
  /** Continent (classement de mledoze/countries ; la Russie est en Europe, la Turquie en Asie). */
  region: Region;
}

export type Region = "Africa" | "Americas" | "Asia" | "Europe" | "Oceania";

/** Côté du carré (viewBox) dans lequel les silhouettes de data/shapes.json sont projetées. */
export const SHAPE_SIZE = 400;

export function countryAnswer(country: Country): string {
  return country.aka ? `${country.name} (${country.aka})` : country.name;
}

export function flagUrl(country: Country): string {
  return `https://flagcdn.com/w640/${country.code.toLowerCase()}.png`;
}
