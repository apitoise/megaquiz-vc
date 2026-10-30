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

/** Personnalité du pool (data/people.json) : portrait tiré de l'article Wikipédia. */
export interface Person {
  slug: string;
  name: string;
  /** cinema, musique, sport, histoire ou culture (tirage équilibré). */
  category: string;
  image: string;
}

/** Plat du pool (data/dishes.json). */
export interface Dish {
  slug: string;
  name: string;
  /** Pays ou région d'origine, affiché avec la réponse. */
  country: string;
  /** france, europe, asie, ameriques ou afrique-orient (tirage équilibré). */
  region: string;
  image: string;
}

/** Logo du pool (data/logos.json) : emblème sans le nom de la marque. */
export interface Logo {
  slug: string;
  name: string;
  /** tech, mode, auto, conso, medias ou sport (tirage équilibré). */
  category: string;
  /** Fichier Commons d'origine (pour la relecture). */
  file: string;
  image: string;
}
