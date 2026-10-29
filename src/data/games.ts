/** Un jeu du pool (data/games.json). Les ids d'images IGDB sont stables : pas d'appel API en partie. */
export interface Game {
  /** Identifiant IGDB. */
  id: number;
  name: string;
  year: number | null;
  /** Nombre de notes IGDB (total_rating_count), mesure de notoriété. */
  ratings: number;
  /** image_id de la jaquette, ou null. */
  cover: string | null;
  /** image_id des screenshots. */
  screenshots: string[];
}

const IMAGES = "https://images.igdb.com/igdb/image/upload";

/** Jaquette 528×704 (lisible sur grand écran). */
export function coverUrl(imageId: string): string {
  return `${IMAGES}/t_cover_big_2x/${imageId}.jpg`;
}

export function screenshotUrl(imageId: string): string {
  return `${IMAGES}/t_1080p/${imageId}.jpg`;
}
