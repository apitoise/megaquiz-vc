// Nettoyage des titres Deezer pour la révélation : on retire les mentions de version
// (« (Remastered 2011) », « - Radio Edit », « (feat. X) »…) sans toucher aux
// parenthèses qui font partie du titre (« Sweet Dreams (Are Made of This) »).

/** Mentions reconnues n'importe où dans un groupe entre parenthèses ou après un tiret. */
const NOISE_ANYWHERE =
  /remaster|remastéris|\bradio edit\b|\bedit\b|\bversion\b|\bremix|\bre-?recorded\b|\bmono\b|\bst[eé]r[eé]o\b|\bdeluxe\b|\bbonus\b|\bdemo\b|\bexplicit\b|\banniversary\b|\b[eé]dition\b|\bsoundtrack\b|bande originale|\binstrumental\b|\bextended\b|\bsingle\b|\bacoustic\b|\bacoustique\b|\bunplugged\b|\bvs\.?\s|\bofficial\b|\bcolors show\b|\bbooska\b/i;
/** Mentions reconnues en début de groupe : « (feat. X) », « (with X) », « (from "Film") », « (Live at …) ». */
const NOISE_START = /^(feat\b|feat\.|ft\.|ft\b|featuring\b|with\b|avec\b|from\b|tir[eé] (du|de)\b|prod\b|prod\.|live\b|en duo\b|duo avec\b)/i;
/** Mentions reconnues en fin de groupe : « (Original Mix) », « (Live) ». */
const NOISE_END = /(\bmix|\blive|\bb\.?o\.?)$/i;
const YEAR_ONLY = /^\d{4}$/;

function isNoise(fragment: string): boolean {
  const text = fragment.trim();
  return NOISE_ANYWHERE.test(text) || NOISE_START.test(text) || NOISE_END.test(text) || YEAR_ONLY.test(text);
}

export function cleanTitle(raw: string): string {
  let title = raw.replace(/\s+/g, " ").trim();
  for (let previous = ""; previous !== title; ) {
    previous = title;
    // Groupes entre parenthèses ou crochets.
    title = title.replace(/\s*[([]([^()[\]]*)[)\]]/g, (group, inner: string) => (isNoise(inner) ? "" : group));
    // Segments après « - », « – » ou « — » (jamais le premier).
    const parts = title.split(/\s+[-–—]\s+/);
    while (parts.length > 1 && isNoise(parts[parts.length - 1])) parts.pop();
    title = parts.join(" - ");
    // « feat. X » hors parenthèses.
    title = title.replace(/\s+(feat\.?|ft\.|featuring)\s.*$/i, "");
    title = title.trim();
  }
  // Ne jamais rendre un titre vide (titre entièrement entre parenthèses, par exemple).
  return title || raw.trim();
}

/** Artiste principal, sans les invités (« A feat. B », « A & B » sont conservés tels quels sauf feat). */
export function cleanArtist(raw: string): string {
  return raw.replace(/\s+(feat\.?|ft\.|featuring)\s.*$/i, "").trim() || raw.trim();
}

/** Clé de dédoublonnage : un même morceau sur plusieurs albums (original, compilation, remaster). */
export function trackKey(title: string, artist: string): string {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${norm(cleanTitle(title))}|${norm(cleanArtist(artist))}`;
}
