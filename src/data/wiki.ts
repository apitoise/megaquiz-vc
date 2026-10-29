/** Œuvre d'art du pool (data/art.json) : image tirée de l'article Wikipédia. */
export interface Artwork {
  slug: string;
  title: string;
  /** Artiste, ou null pour une œuvre anonyme (un seul jugement). */
  artist: string | null;
  image: string;
}

/** Monument ou lieu connu du pool (data/landmarks.json). */
export interface Landmark {
  slug: string;
  name: string;
  /** Ville et/ou pays, affiché avec la réponse. */
  place: string;
  image: string;
}
