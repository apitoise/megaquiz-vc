// fetch avec cache disque et temporisation par hôte, pour la construction des pools.
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CACHE_DIR = ".cache/http";
const DEFAULT_TTL_MS = 7 * 24 * 3600 * 1000;
/** Délai minimal entre deux requêtes vers un même hôte. */
const MIN_INTERVAL_MS = 250;

const lastCall = new Map<string, number>();

async function throttle(host: string, intervalMs: number): Promise<void> {
  const wait = (lastCall.get(host) ?? 0) + intervalMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall.set(host, Date.now());
}

export interface FetchOptions {
  ttlMs?: number;
  intervalMs?: number;
  init?: RequestInit;
}

/** GET (ou requête décrite par `init`) dont la réponse JSON est mise en cache. */
export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { ttlMs = DEFAULT_TTL_MS, intervalMs = MIN_INTERVAL_MS, init } = options;
  const key = createHash("sha1").update(`${init?.method ?? "GET"} ${url} ${init?.body ?? ""}`).digest("hex");
  const file = join(CACHE_DIR, `${key}.json`);
  try {
    const info = await stat(file);
    if (Date.now() - info.mtimeMs < ttlMs) return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    // pas en cache
  }

  for (let attempt = 1; ; attempt++) {
    await throttle(new URL(url).host, intervalMs);
    const res = await fetch(url, init);
    if (res.status === 429 && attempt < 5) {
      const retry = Number(res.headers.get("retry-after")) || 2 ** attempt;
      console.warn(`  429 sur ${url}, nouvel essai dans ${retry} s`);
      await new Promise((r) => setTimeout(r, retry * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} : ${url}`);
    const text = await res.text();
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, text);
    return JSON.parse(text) as T;
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(data, null, 1)}\n`);
}
