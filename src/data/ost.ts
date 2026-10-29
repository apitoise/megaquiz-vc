/** Un jeu du thème OST (data/ost.json) : album Deezer validé et ids de pistes. */
export interface OstGame {
  /** Identifiant stable dérivé du nom du jeu. */
  slug: string;
  name: string;
  album: { id: number; title: string; artist: string };
  /** Pistes jouables, les plus populaires d'abord. L'URL d'extrait est demandée en partie (elle expire). */
  tracks: number[];
}

/** Entrée de la liste curée data/ost_games.json. */
export interface OstCandidate {
  name: string;
  /** Texte que le titre d'album doit contenir (par défaut : le nom du jeu). */
  match?: string;
  /** Album Deezer imposé à la main (contourne la recherche et la validation). */
  album?: number;
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
