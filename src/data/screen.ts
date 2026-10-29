/** Un film ou une série du pool (data/films.json, data/series.json), d'après TMDB. */
export interface ScreenWork {
  /** Identifiant TMDB. */
  id: number;
  /** Réponse affichée : titre français, et titre original entre parenthèses s'il diffère. */
  name: string;
  year: number | null;
  /** Nombre de votes TMDB (mesure de notoriété). */
  votes: number;
  /** Affiche sans texte (aucune langue chez TMDB), ou null s'il n'y en a pas. */
  textlessPoster: string | null;
  /** Affiche officielle (avec titre), montrée en vignette à la révélation. */
  poster: string | null;
  /** Images de scène sans texte, les mieux notées d'abord. */
  backdrops: string[];
}

const IMAGES = "https://image.tmdb.org/t/p";

export function posterUrl(path: string): string {
  return `${IMAGES}/w780${path}`;
}

export function backdropUrl(path: string): string {
  return `${IMAGES}/w1280${path}`;
}
