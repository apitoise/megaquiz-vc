// Validation d'un album Deezer comme bande originale d'un jeu (logique pure, testée).
import { normalize } from "../data/ost.ts";

/** Mots tolérés autour du nom du jeu dans un titre d'OST. */
const SOUNDTRACK_WORDS = new Set(
  "original game video soundtrack soundtracks sound track recording ost score music musique from the official vol volume digital deluxe edition selected complete collection bande originale du jeu de playstation xbox".split(
    " ",
  ),
);
/** Il faut au moins un de ces mots pour parler d'une bande originale. */
const SOUNDTRACK_MARKERS = /\b(soundtrack|sound track|ost|score|bande originale)\b/;
/** Films, séries, reprises, fan-games : jamais l'OST officielle du jeu. */
const REJECT =
  /\b(movie|motion picture|film|series|season|netflix|television|tv|anime|piano|music box|cover|covers|tribute|remix|remixes|arrangement|arranged|arrangements|lofi|lo fi|fangame|fan|unofficial|inspired|orchestral|symphony|live|concert|karaoke|lullaby|8 bit|chiptune|guitar|acoustic)\b/;

export interface AlbumCandidate {
  id: number;
  title: string;
  artist: string;
  nb_tracks: number;
  record_type: string;
}

export type Verdict =
  | { status: "ok"; album: AlbumCandidate }
  | { status: "douteux"; album: AlbumCandidate; reason: string }
  | { status: "absent" };

/** Ce qui reste du titre une fois retirés le nom du jeu et les mots d'OST : vide = correspondance exacte. */
export function residue(albumTitle: string, match: string): string | null {
  const title = ` ${normalize(albumTitle)} `;
  const needle = ` ${normalize(match)} `;
  const at = title.indexOf(needle);
  if (at < 0) return null;
  const rest = (title.slice(0, at) + " " + title.slice(at + needle.length)).trim();
  return rest
    .split(" ")
    .filter((word) => word && !SOUNDTRACK_WORDS.has(word))
    .join(" ");
}

/** Choisit le meilleur album pour un jeu parmi les résultats de recherche. */
export function judgeAlbums(match: string, albums: AlbumCandidate[]): Verdict {
  const scored = albums
    .map((album) => ({ album, rest: residue(album.title, match) }))
    .filter((c): c is { album: AlbumCandidate; rest: string } => c.rest !== null && !REJECT.test(normalize(c.album.title)))
    // Le moins de texte superflu d'abord (évite « FF VII REMAKE » pour « FF VII »), puis le plus de pistes.
    .sort((a, b) => a.rest.length - b.rest.length || b.album.nb_tracks - a.album.nb_tracks);
  const best = scored[0];
  if (!best) return { status: "absent" };

  const { album, rest } = best;
  if (rest) return { status: "douteux", album, reason: `titre avec « ${rest} » en plus du nom du jeu` };
  if (!SOUNDTRACK_MARKERS.test(normalize(album.title))) return { status: "douteux", album, reason: "pas de mention « soundtrack » / « OST »" };
  if (album.record_type === "single" || album.nb_tracks < 5) return { status: "douteux", album, reason: `seulement ${album.nb_tracks} piste(s)` };
  return { status: "ok", album };
}
