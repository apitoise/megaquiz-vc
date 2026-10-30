/** Un album du pool « Pochettes d'album » (data/albums.json, généré par `npm run build-pools -- albums`). */
export interface Album {
  slug: string;
  title: string;
  artist: string;
  /** Pochette 1000×1000 (CDN Deezer, URL stable). */
  cover: string;
}
