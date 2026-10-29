/** Un morceau du pool (data/music.json). L'URL d'extrait n'est pas stockée : elle expire (~15 min). */
export interface Track {
  /** Identifiant Deezer. */
  id: number;
  /** Titre nettoyé, affiché à la révélation. */
  title: string;
  artist: string;
  /** Popularité Deezer au moment de la construction du pool. */
  rank: number;
  /** Style (rap, rock, variete…) : le tirage équilibre les styles. */
  style: string;
}

/** Réponse simplifiée du proxy local /api/deezer/track/:id. */
export interface FreshTrack {
  id: number;
  preview: string;
  cover: string | null;
}
