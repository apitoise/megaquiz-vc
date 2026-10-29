// Accès à l'API publique Deezer pour la construction des pools (musique, OST).
import { fetchJson } from "./http.ts";

const API = "https://api.deezer.com";
/** Deezer tolère ~50 requêtes / 5 s : on reste très en dessous. */
const INTERVAL_MS = 150;

export interface DeezerTrack {
  id: number;
  title: string;
  title_short?: string;
  rank: number;
  readable: boolean;
  preview: string;
  artist: { id: number; name: string };
  album?: { id: number; title: string };
}

export interface DeezerPlaylist {
  id: number;
  title: string;
  nb_tracks: number;
  user: { id: number; name: string };
}

interface Page<T> {
  data: T[];
  total?: number;
  next?: string;
  error?: { type: string; message: string; code: number };
}

export async function deezer<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(API + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const body = await fetchJson<T & { error?: { message: string; code: number } }>(url.toString(), { intervalMs: INTERVAL_MS });
  // Deezer signale ses erreurs (quota, id inconnu…) dans un corps HTTP 200.
  if (body.error) throw new Error(`Deezer ${path} : ${body.error.message} (${body.error.code})`);
  return body;
}

/** Tous les éléments d'une liste paginée (index/limit). */
export async function deezerAll<T>(path: string, max = 500): Promise<T[]> {
  const items: T[] = [];
  for (let index = 0; items.length < max; ) {
    const page = await deezer<Page<T>>(path, { index, limit: 100 });
    items.push(...page.data);
    index += page.data.length;
    if (!page.next || !page.data.length) break;
  }
  return items.slice(0, max);
}

/** Compte éditorial Deezer (« Deezer Best Of », « Laeti - Deezer Pop Editor », « Alexandre - Pop & Hits Editor »…). */
export function isEditorial(playlist: DeezerPlaylist): boolean {
  return /deezer|editor|editrice|éditeur|éditrice/i.test(playlist.user.name);
}

/** Playlist éditoriale dont le titre correspond exactement (casse ignorée), ou null. */
export async function findEditorialPlaylist(title: string): Promise<DeezerPlaylist | null> {
  const results = await deezer<Page<DeezerPlaylist>>("/search/playlist", { q: title, limit: 25 });
  const wanted = title.toLocaleLowerCase("fr");
  return results.data.find((p) => isEditorial(p) && p.title.trim().toLocaleLowerCase("fr") === wanted) ?? null;
}
