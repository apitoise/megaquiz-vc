// Pools « Art » et « Monuments » : listes curées (data/art_curated.json, data/landmarks_curated.json),
// image principale de l'article Wikipédia en français, vérifiée via Wikidata :
// - œuvre : le créateur (P170) doit correspondre à l'artiste attendu (sinon : mauvais article) ;
// - lieu : il doit avoir des coordonnées (P625), ce qui écarte un homonyme qui n'est pas un lieu.
// Pas de clé : API publique de Wikimédia, avec un User-Agent identifiant le projet (règle Wikimédia).
// Les œuvres encore protégées par le droit d'auteur n'ont pas d'image sur Wikipédia : elles sont exclues.
import { readFile } from "node:fs/promises";
import { normalize, slugify } from "../../src/data/ost.ts";
import type { Artwork, Dish, Landmark, Person } from "../../src/data/wiki.ts";
import { fetchJson, writeJson } from "./http.ts";

const USER_AGENT = "MegaQuiz/1.0 (quiz local personnel ; https://github.com/apitoise/megaquiz-vc)";
const INTERVAL_MS = 300;
const BATCH = 50;
/** Largeur des images demandées (vignette générée par Wikimédia). */
const IMAGE_WIDTH = 1000;
const IMAGE_EXT = /\.(jpe?g|png)$/i;

interface Page {
  title: string;
  missing?: boolean;
  pageimage?: string;
  thumbnail?: { source: string };
  pageprops?: { wikibase_item?: string; disambiguation?: string };
}

interface Entity {
  claims: Record<string, { mainsnak: { datavalue?: { value: { id?: string } | unknown } } }[]>;
  labels?: Record<string, { value: string }>;
}

type Coverage = { name: string; status: "ok" | "absent"; reason?: string; article?: string };
/** Entrée de liste curée ; `exclude` (avec sa raison) écarte une image vérifiée à l'œil et jugée inutilisable. */
type Curated<T> = T & { wiki: string; exclude?: string };

const get = <T>(url: string) => fetchJson<T>(url, { intervalMs: INTERVAL_MS, init: { headers: { "User-Agent": USER_AGENT } } });

/** Articles Wikipédia (redirections suivies), par titre demandé. */
export async function pages(titles: string[]): Promise<Map<string, Page>> {
  const byTitle = new Map<string, Page>();
  for (let i = 0; i < titles.length; i += BATCH) {
    const batch = titles.slice(i, i + BATCH);
    const url = new URL("https://fr.wikipedia.org/w/api.php");
    for (const [k, v] of Object.entries({
      action: "query",
      titles: batch.join("|"),
      prop: "pageimages|pageprops",
      piprop: "thumbnail|name",
      pithumbsize: String(IMAGE_WIDTH),
      ppprop: "wikibase_item|disambiguation",
      redirects: "1",
      format: "json",
      formatversion: "2",
    })) {
      url.searchParams.set(k, v);
    }
    const res = await get<{ query: { pages: Page[]; redirects?: { from: string; to: string }[]; normalized?: { from: string; to: string }[] } }>(url.toString());
    const alias = new Map<string, string>();
    for (const r of [...(res.query.normalized ?? []), ...(res.query.redirects ?? [])]) alias.set(r.from, r.to);
    const resolve = (t: string) => {
      let current = t;
      for (let n = 0; n < 3 && alias.has(current); n++) current = alias.get(current)!;
      return current;
    };
    const found = new Map(res.query.pages.map((p) => [p.title, p]));
    for (const t of batch) {
      const page = found.get(resolve(t));
      if (page) byTitle.set(t, page);
    }
  }
  return byTitle;
}

async function entities(ids: string[], props = "claims"): Promise<Map<string, Entity>> {
  const out = new Map<string, Entity>();
  for (let i = 0; i < ids.length; i += BATCH) {
    const url = new URL("https://www.wikidata.org/w/api.php");
    for (const [k, v] of Object.entries({ action: "wbgetentities", ids: ids.slice(i, i + BATCH).join("|"), props, languages: "fr|en", format: "json" })) {
      url.searchParams.set(k, v);
    }
    const res = await get<{ entities: Record<string, Entity> }>(url.toString());
    for (const [id, e] of Object.entries(res.entities)) out.set(id, e);
  }
  return out;
}

const refs = (e: Entity | undefined, prop: string) =>
  (e?.claims[prop] ?? []).map((c) => (c.mainsnak.datavalue?.value as { id?: string } | undefined)?.id).filter((x): x is string => !!x);

/** Vignette de l'image, sans les paramètres de suivi (utm_…) que l'API ajoute. */
export function imageUrl(page: Page): string {
  const url = new URL(page.thumbnail!.source);
  url.search = "";
  return url.toString();
}

/** Raison d'écarter un article, ou null s'il convient. */
export function pageProblem(page: Page | undefined): string | null {
  if (!page || page.missing) return "article introuvable";
  if (page.pageprops?.disambiguation !== undefined) return "page d'homonymie";
  if (!page.pageimage || !page.thumbnail) return "pas d'image (œuvre protégée ou article sans illustration)";
  if (!IMAGE_EXT.test(page.pageimage)) return `image non photographique (${page.pageimage})`;
  if (!page.pageprops?.wikibase_item) return "pas d'élément Wikidata";
  return null;
}

/** Le créateur Wikidata correspond-il à l'artiste attendu (un mot significatif en commun) ? */
function sameArtist(expected: string, labels: string[]): boolean {
  // Mots d'au moins 4 lettres : « Gogh », « Eyck », « Vinci »… (pas « van », « de », « la »).
  const words = normalize(expected)
    .split(" ")
    .filter((w) => w.length >= 4);
  return labels.some((label) => words.some((w) => normalize(label).split(" ").includes(w)));
}

function report(label: string, coverage: Coverage[]): void {
  const absent = coverage.filter((c) => c.status === "absent");
  console.log(`  ${coverage.length - absent.length}/${coverage.length} ${label} retenus`);
  for (const c of absent) console.log(`    absent  ${c.name} : ${c.reason}`);
}

export async function buildArt(): Promise<void> {
  const curated = (JSON.parse(await readFile("data/art_curated.json", "utf8")) as Curated<{ title: string; artist: string | null }>[]).filter(
    (c) => !c.exclude,
  );
  const found = await pages(curated.map((c) => c.wiki));
  const items = await entities([...new Set([...found.values()].map((p) => p.pageprops?.wikibase_item).filter((x): x is string => !!x))]);
  const creatorIds = [...new Set([...items.values()].flatMap((e) => refs(e, "P170")))];
  const creators = await entities(creatorIds, "labels");

  const art: Artwork[] = [];
  const coverage: Coverage[] = [];
  for (const c of curated) {
    const page = found.get(c.wiki);
    const problem = pageProblem(page);
    if (problem) {
      coverage.push({ name: c.title, status: "absent", reason: problem });
      continue;
    }
    if (c.artist) {
      const labels = refs(items.get(page!.pageprops!.wikibase_item!), "P170").flatMap((id) =>
        Object.values(creators.get(id)?.labels ?? {}).map((l) => l.value),
      );
      if (!sameArtist(c.artist, labels)) {
        coverage.push({ name: c.title, status: "absent", reason: `créateur Wikidata « ${labels.join(", ") || "aucun"} » ≠ ${c.artist}`, article: page!.title });
        continue;
      }
    }
    art.push({ slug: slugify(c.title), title: c.title, artist: c.artist, image: imageUrl(page!) });
    coverage.push({ name: c.title, status: "ok", article: page!.title });
  }
  await writeJson("data/art.json", art);
  report("œuvres", coverage);
}

/** Personnalités : l'élément Wikidata doit être un être humain (P31 = Q5), pas un homonyme (film, album…). */
export async function buildPeople(): Promise<void> {
  const curated = (
    JSON.parse(await readFile("data/people_curated.json", "utf8")) as (Omit<Curated<{ name: string; category: string }>, "wiki"> & { wiki?: string })[]
  ).filter((c) => !c.exclude);
  const title = (c: { name: string; wiki?: string }) => c.wiki ?? c.name;
  const found = await pages(curated.map(title));
  const items = await entities([...new Set([...found.values()].map((p) => p.pageprops?.wikibase_item).filter((x): x is string => !!x))]);

  const people: Person[] = [];
  const coverage: Coverage[] = [];
  for (const c of curated) {
    const page = found.get(title(c));
    const problem = pageProblem(page) ?? (refs(items.get(page!.pageprops!.wikibase_item!), "P31").includes("Q5") ? null : "pas une personne (homonyme ?)");
    if (problem) {
      coverage.push({ name: c.name, status: "absent", reason: problem });
      continue;
    }
    people.push({ slug: slugify(c.name), name: c.name, category: c.category, image: imageUrl(page!) });
    coverage.push({ name: c.name, status: "ok", article: page!.title });
  }
  await writeJson("data/people.json", people);
  report("personnalités", coverage);
}

/** Plats : image de l'article, sans autre vérification (une liste curée suffit à écarter les homonymes). */
export async function buildDishes(): Promise<void> {
  const curated = (
    JSON.parse(await readFile("data/dishes_curated.json", "utf8")) as (Omit<Curated<{ name: string; country: string; region: string }>, "wiki"> & {
      wiki?: string;
    })[]
  ).filter((c) => !c.exclude);
  const title = (c: { name: string; wiki?: string }) => c.wiki ?? c.name;
  const found = await pages(curated.map(title));

  const dishes: Dish[] = [];
  const coverage: Coverage[] = [];
  for (const c of curated) {
    const page = found.get(title(c));
    const problem = pageProblem(page);
    if (problem) {
      coverage.push({ name: c.name, status: "absent", reason: problem });
      continue;
    }
    dishes.push({ slug: slugify(c.name), name: c.name, country: c.country, region: c.region, image: imageUrl(page!) });
    coverage.push({ name: c.name, status: "ok", article: page!.title });
  }
  await writeJson("data/dishes.json", dishes);
  report("plats", coverage);
}

export async function buildLandmarks(): Promise<void> {
  const curated = (JSON.parse(await readFile("data/landmarks_curated.json", "utf8")) as Curated<{ name: string; place: string }>[]).filter(
    (c) => !c.exclude,
  );
  const found = await pages(curated.map((c) => c.wiki));
  const items = await entities([...new Set([...found.values()].map((p) => p.pageprops?.wikibase_item).filter((x): x is string => !!x))]);

  const landmarks: Landmark[] = [];
  const coverage: Coverage[] = [];
  for (const c of curated) {
    const page = found.get(c.wiki);
    const problem = pageProblem(page) ?? (items.get(page!.pageprops!.wikibase_item!)?.claims.P625 ? null : "pas de coordonnées (ce n'est pas un lieu ?)");
    if (problem) {
      coverage.push({ name: c.name, status: "absent", reason: problem });
      continue;
    }
    landmarks.push({ slug: slugify(c.name), name: c.name, place: c.place, image: imageUrl(page!) });
    coverage.push({ name: c.name, status: "ok", article: page!.title });
  }
  await writeJson("data/landmarks.json", landmarks);
  report("lieux", coverage);
}
