// Pools films et séries : les plus connus d'après TMDB (nombre de votes), titres français,
// affiches et images de scène SANS TEXTE (TMDB classe ces images « sans langue »).
// Le jeton (TMDB_READ_TOKEN, .env) ne sert qu'ici : en partie, les images viennent du CDN, sans clé.
import type { ScreenWork } from "../../src/data/screen.ts";
import { fetchJson, writeJson } from "./http.ts";

const API = "https://api.themoviedb.org/3";
/** TMDB tolère ~50 requêtes/s : on reste très en dessous. */
const INTERVAL_MS = 60;
export const FILM_COUNT = 600;
export const SERIES_COUNT = 300;
/** Images de scène gardées par œuvre (une tirée au hasard par question). */
const BACKDROPS_PER_WORK = 8;
/** Genres de séries écartés : jeunesse, actualités, téléréalité, soap, talk-show. */
const EXCLUDED_TV_GENRES = new Set([10762, 10763, 10764, 10766, 10767]);
const ANIMATION = 16;

type Kind = "movie" | "tv";

interface DiscoverItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  original_language: string;
  release_date?: string;
  first_air_date?: string;
  vote_count: number;
  poster_path: string | null;
  genre_ids: number[];
}

interface TmdbImage {
  file_path: string;
  iso_639_1: string | null;
  vote_average: number;
  vote_count: number;
}

function tmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new Error("TMDB_READ_TOKEN doit être défini dans .env (themoviedb.org → Paramètres → API)");
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  // Le jeton est dans un en-tête, jamais dans l'URL (qui sert de clé de cache).
  return fetchJson<T>(url.toString(), { intervalMs: INTERVAL_MS, init: { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } } });
}

/** Séries : pas de programmes jeunesse, de téléréalité… ni d'anime (animation japonaise). */
function keepSeries(item: DiscoverItem): boolean {
  if (item.genre_ids.some((g) => EXCLUDED_TV_GENRES.has(g))) return false;
  return !(item.genre_ids.includes(ANIMATION) && item.original_language === "ja");
}

async function popular(kind: Kind, count: number): Promise<DiscoverItem[]> {
  // Par id : le classement bouge un peu d'une page à l'autre, une œuvre peut revenir deux fois.
  const items = new Map<number, DiscoverItem>();
  for (let page = 1; items.size < count && page <= 50; page++) {
    const res = await tmdb<{ results: DiscoverItem[] }>(`/discover/${kind}`, { language: "fr-FR", sort_by: "vote_count.desc", page });
    for (const x of res.results) if (kind === "movie" || keepSeries(x)) items.set(x.id, items.get(x.id) ?? x);
  }
  return [...items.values()].slice(0, count);
}

const best = (images: TmdbImage[]) => [...images].sort((a, b) => b.vote_count - a.vote_count || b.vote_average - a.vote_average);

async function toWork(kind: Kind, item: DiscoverItem): Promise<ScreenWork> {
  const images = await tmdb<{ posters: TmdbImage[]; backdrops: TmdbImage[] }>(`/${kind}/${item.id}/images`, {
    include_image_language: "null",
  });
  const title = (kind === "movie" ? item.title : item.name) ?? "";
  const original = (kind === "movie" ? item.original_title : item.original_name) ?? "";
  // Titre original affiché seulement s'il diffère et s'écrit en alphabet latin (pas « 오징어 게임 »).
  const showOriginal = original && original.toLowerCase() !== title.toLowerCase() && /^[\p{Script=Latin}\d\s\p{P}]+$/u.test(original);
  const date = kind === "movie" ? item.release_date : item.first_air_date;
  return {
    id: item.id,
    name: showOriginal ? `${title} (${original})` : title,
    year: date ? Number(date.slice(0, 4)) : null,
    votes: item.vote_count,
    textlessPoster: best(images.posters.filter((p) => p.iso_639_1 === null))[0]?.file_path ?? null,
    poster: item.poster_path,
    backdrops: best(images.backdrops.filter((b) => b.iso_639_1 === null))
      .slice(0, BACKDROPS_PER_WORK)
      .map((b) => b.file_path),
  };
}

export async function buildScreen(kind: Kind): Promise<void> {
  const [count, output, label] = kind === "movie" ? [FILM_COUNT, "data/films.json", "films"] : [SERIES_COUNT, "data/series.json", "séries"];
  const items = await popular(kind, count);
  const works: ScreenWork[] = [];
  for (const item of items) works.push(await toWork(kind, item));
  await writeJson(output, works);
  const withPoster = works.filter((w) => w.textlessPoster).length;
  const withBackdrops = works.filter((w) => w.backdrops.length).length;
  console.log(`  ${works.length} ${label} (≥ ${works.at(-1)?.votes} votes TMDB)`);
  console.log(`  ${withPoster} avec une affiche sans texte, ${withBackdrops} avec des images de scène`);
}
