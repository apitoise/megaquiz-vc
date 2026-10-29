// Proxy Deezer : l'API ne renvoie pas d'en-tête Access-Control-Allow-Origin.
// On n'expose que ce dont le jeu a besoin : une URL d'extrait fraîche (elle expire en ~15 min).
import type { FreshTrack } from "../src/data/music.ts";
import { HttpError, sendJson, type Handler } from "./respond.ts";

const TIMEOUT_MS = 8000;

interface DeezerTrack {
  id: number;
  readable?: boolean;
  preview?: string;
  album?: { cover_big?: string };
  error?: { message: string; code: number };
}

export const deezerTrack: Handler = async (_req, res, [id]) => {
  const upstream = await fetch(`https://api.deezer.com/track/${id}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!upstream.ok) throw new HttpError(502, "deezer_http", `Deezer HTTP ${upstream.status}`);
  const track = (await upstream.json()) as DeezerTrack;
  // Deezer signale ses erreurs (id inconnu, quota) dans un corps HTTP 200.
  if (track.error) {
    const quota = track.error.code === 4;
    throw new HttpError(quota ? 429 : 404, quota ? "deezer_quota" : "deezer_error", track.error.message);
  }
  if (!track.readable || !track.preview) throw new HttpError(404, "no_preview");
  const body: FreshTrack = { id: track.id, preview: track.preview, cover: track.album?.cover_big ?? null };
  sendJson(res, 200, body);
};
