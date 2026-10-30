// Pool « Logos » : liste curée (data/logos_curated.json). Le logo vient de Wikidata (icône P8972, sinon logo P154) ou,
// à défaut, de l'image de l'article Wikipédia ; `file` impose un fichier Commons précis (un emblème sans texte,
// quand le logo officiel écrit le nom). Les SVG sont servis en PNG par Wikimédia. Chaque logo est relu
// à l'œil : `exclude` écarte ceux qui écrivent le nom de la marque (la question n'aurait plus d'intérêt).
import { readFile } from "node:fs/promises";
import type { Logo } from "../../src/data/wiki.ts";
import { slugify } from "../../src/data/ost.ts";
import { fetchJson, writeJson } from "./http.ts";
import { pages } from "./wiki.ts";

const USER_AGENT = "MegaQuiz/1.0 (quiz local personnel ; https://github.com/apitoise/megaquiz-vc)";
const INTERVAL_MS = 300;
const BATCH = 50;
/** Largeur des logos (PNG généré par Wikimédia, même pour un SVG). */
const LOGO_WIDTH = 640;

interface Curated {
  name: string;
  wiki?: string;
  category: string;
  /** Fichier Commons imposé (« Apple logo black.svg »). */
  file?: string;
  exclude?: string;
}

const get = <T>(url: string) => fetchJson<T>(url, { intervalMs: INTERVAL_MS, init: { headers: { "User-Agent": USER_AGENT } } });

function api(host: string, params: Record<string, string>): string {
  const url = new URL(`https://${host}/w/api.php`);
  for (const [k, v] of Object.entries({ ...params, format: "json", formatversion: "2" })) url.searchParams.set(k, v);
  return url.toString();
}

/** Logo Wikidata de chaque élément, par id d'élément. */
async function wikidataLogos(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += BATCH) {
    const res = await get<{ entities: Record<string, { claims?: Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]> }> }>(
      api("www.wikidata.org", { action: "wbgetentities", ids: ids.slice(i, i + BATCH).join("|"), props: "claims" }),
    );
    for (const [id, e] of Object.entries(res.entities)) {
      // Icône (P8972, souvent le symbole seul) plutôt que le logo complet (P154, qui écrit souvent le nom).
      const file = (e.claims?.P8972 ?? e.claims?.P154)?.[0]?.mainsnak.datavalue?.value;
      if (typeof file === "string") out.set(id, file);
    }
  }
  return out;
}

/** URL d'une vignette PNG/JPEG de chaque fichier Commons, par nom de fichier. */
async function thumbnails(files: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const res = await get<{
      query: { pages: { title: string; imageinfo?: { thumburl?: string }[] }[]; normalized?: { from: string; to: string }[] };
    }>(api("commons.wikimedia.org", { action: "query", titles: batch.map((f) => `File:${f}`).join("|"), prop: "imageinfo", iiprop: "url", iiurlwidth: String(LOGO_WIDTH) }));
    const byTitle = new Map(res.query.pages.map((p) => [p.title, p.imageinfo?.[0]?.thumburl]));
    const alias = new Map((res.query.normalized ?? []).map((n) => [n.from, n.to]));
    for (const f of batch) {
      const url = byTitle.get(alias.get(`File:${f}`) ?? `File:${f}`);
      if (url) out.set(f, url);
    }
  }
  return out;
}

export async function buildLogos(): Promise<void> {
  const curated = (JSON.parse(await readFile("data/logos_curated.json", "utf8")) as Curated[]).filter((c) => !c.exclude);
  const title = (c: Curated) => c.wiki ?? c.name;
  const found = await pages(curated.filter((c) => !c.file).map(title));
  const items = [...found.values()].map((p) => p.pageprops?.wikibase_item).filter((x): x is string => !!x);
  const logos = await wikidataLogos([...new Set(items)]);

  const fileOf = new Map<Curated, string>();
  for (const c of curated) {
    const page = found.get(title(c));
    const file = c.file ?? logos.get(page?.pageprops?.wikibase_item ?? "") ?? page?.pageimage;
    if (file) fileOf.set(c, file.replace(/_/g, " "));
  }
  const urls = await thumbnails([...new Set(fileOf.values())]);

  const out: Logo[] = [];
  const absent: string[] = [];
  for (const c of curated) {
    const file = fileOf.get(c);
    const image = file && urls.get(file);
    if (!image) {
      absent.push(`${c.name} : ${file ? `vignette introuvable (${file})` : "aucun logo"}`);
      continue;
    }
    out.push({ slug: slugify(c.name), name: c.name, category: c.category, file: file!, image });
  }
  await writeJson("data/logos.json", out);
  console.log(`  ${out.length}/${curated.length} logos retenus`);
  for (const a of absent) console.log(`    absent  ${a}`);
}
