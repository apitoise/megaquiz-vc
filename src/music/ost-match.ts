// Validation d'un album Deezer comme bande originale d'un jeu, d'un film ou d'une série (logique pure, testée).
import { normalize } from "../data/ost.ts";

export type SoundtrackKind = "game" | "film" | "series";

/** Mots tolérés autour du nom de l'œuvre dans un titre d'OST (les mots interdits sont filtrés à part). */
const SOUNDTRACK_WORDS = new Set(
  (
    "original game video soundtrack soundtracks sound track recording ost score music musique from the official vol volume " +
    "digital deluxe edition selected complete collection bande originale du jeu de playstation xbox " +
    "motion picture movie film series season television tv netflix hbo amazon prime apple disney songs theme themes main title a an and"
  ).split(" "),
);
/** Il faut au moins un de ces mots pour parler d'une bande originale. */
const SOUNDTRACK_MARKERS = /\b(soundtrack|sound track|ost|score|bande originale|music from|musique originale)\b/;
/** Reprises, remixes, fan-made : jamais l'OST officielle, quel que soit le type d'œuvre. */
const ALWAYS_REJECT =
  "piano|music box|cover|covers|tribute|remix|remixes|arrangement|arranged|arrangements|lofi|lo fi|fangame|fan|unofficial|karaoke|lullaby|8 bit|chiptune|guitar|acoustic|live|concert";
const REJECT: Record<SoundtrackKind, RegExp> = {
  // Pour un jeu : pas de film ni de série du même nom (« The Witcher » Netflix, « Super Mario Bros. » le film).
  game: new RegExp(`\\b(${ALWAYS_REJECT}|movie|motion picture|film|series|season|netflix|television|tv|anime|inspired|orchestral|symphony)\\b`),
  // Pour un film : pas de série ni de jeu vidéo (« JOKER GAME Original Soundtrack » n'est pas Joker).
  film: new RegExp(`\\b(${ALWAYS_REJECT}|series|season|netflix series|television|tv|video game|game)\\b`),
  // Pour une série : pas de film ni de jeu vidéo.
  series: new RegExp(`\\b(${ALWAYS_REJECT}|motion picture|movie|film|video game|game soundtrack)\\b`),
};
/**
 * Films et séries : les reprises se cachent souvent sous un titre d'OST impeccable, mais sous un nom
 * d'artiste générique (« Film Musical Orchestra », « West End Orchestra and Singers », « Fantasy Vibes »).
 */
const COVER_ARTIST = /\b(orchestra|orchestre|instrumental|instrumentals|magic|singers|players|ensemble|vibes|tribute|cover|covers|karaoke|lullaby|piano|guitar|kids|band|soundtrack orchestra|theme kings)\b/;
const CHECK_ARTIST: Record<SoundtrackKind, boolean> = { game: false, film: true, series: true };
/** Pistes minimum d'un album d'OST (une série peut se réduire à son générique). */
const MIN_ALBUM_TRACKS: Record<SoundtrackKind, number> = { game: 5, film: 5, series: 1 };

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

/** Ce qui reste du titre une fois retirés le nom de l'œuvre et les mots d'OST : vide = correspondance exacte. */
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

function hasMarker(albumTitle: string): boolean {
  return SOUNDTRACK_MARKERS.test(normalize(albumTitle));
}

/** Choisit le meilleur album pour une œuvre parmi les résultats de recherche. */
export function judgeAlbums(match: string, albums: AlbumCandidate[], kind: SoundtrackKind = "game"): Verdict {
  const scored = albums
    .map((album) => ({ album, rest: residue(album.title, match) }))
    .filter((c): c is { album: AlbumCandidate; rest: string } => c.rest !== null && !REJECT[kind].test(normalize(c.album.title)))
    .filter((c) => !CHECK_ARTIST[kind] || !COVER_ARTIST.test(normalize(c.album.artist)))
    // Le moins de texte superflu d'abord (évite « FF VII REMAKE » pour « FF VII »), puis les albums qui se
    // disent OST (avant les reprises homonymes « Interstellar — Soothing Sonata »), puis le plus de pistes.
    .sort(
      (a, b) =>
        a.rest.length - b.rest.length ||
        Number(hasMarker(b.album.title)) - Number(hasMarker(a.album.title)) ||
        b.album.nb_tracks - a.album.nb_tracks,
    );
  const best = scored[0];
  if (!best) return { status: "absent" };

  const { album, rest } = best;
  if (rest) return { status: "douteux", album, reason: `titre avec « ${rest} » en plus du nom` };
  if (!hasMarker(album.title)) return { status: "douteux", album, reason: "pas de mention « soundtrack » / « OST »" };
  if (album.nb_tracks < MIN_ALBUM_TRACKS[kind] || (kind !== "series" && album.record_type === "single")) {
    return { status: "douteux", album, reason: `seulement ${album.nb_tracks} piste(s)` };
  }
  return { status: "ok", album };
}
