/** Une œuvre (jeu, film, série) d'un thème « musique » : album ou générique Deezer validé, ids de pistes. */
export interface Soundtrack {
  /** Identifiant stable dérivé du nom de l'œuvre. */
  slug: string;
  /** Réponse affichée (titre français, original entre parenthèses s'il diffère). */
  name: string;
  album: { id: number; title: string; artist: string };
  /** Pistes jouables, les plus populaires d'abord. L'URL d'extrait est demandée en partie (elle expire). */
  tracks: number[];
}

/** Entrée d'une liste curée (data/ost_games.json, data/ost_films.json, data/ost_series.json). */
export interface SoundtrackCandidate {
  name: string;
  /** Texte que le titre d'album doit contenir (par défaut : le nom). Sert aussi de recherche. */
  match?: string;
  /** Album Deezer imposé à la main (contourne la recherche et la validation). */
  album?: number;
  /** Générique précis à jouer (séries dont le thème est une chanson), au lieu d'un album d'OST. */
  track?: { artist: string; title: string };
}

/** Normalisation pour comparer des titres : minuscules, sans accents ni ponctuation. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(name: string): string {
  return normalize(name).replace(/ /g, "-");
}
