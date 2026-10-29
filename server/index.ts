// Serveur proxy local. Lié à 127.0.0.1 uniquement, même en mode réseau local (`npm run dev:lan`) :
// seul Vite est exposé et lui relaie /api. Le secret Twitch ne quitte donc jamais cette machine.
import { createServer } from "node:http";
import { getReviews, postReview } from "./covers.ts";
import { deezerTrack } from "./deezer.ts";
import { loadEnv } from "./env.ts";
import { isSameOrigin } from "./origin.ts";
import { HttpError, sendJson, type Handler } from "./respond.ts";
import { getResults, postResult } from "./results.ts";

loadEnv();

const HOST = "127.0.0.1";
const PORT = Number(process.env.SERVER_PORT ?? 8787);

const routes: [string, RegExp, Handler][] = [
  ["GET", /^\/api\/health$/, (_req, res) => sendJson(res, 200, { ok: true })],
  ["GET", /^\/api\/deezer\/track\/(\d{1,20})$/, deezerTrack],
  ["GET", /^\/api\/results$/, getResults],
  ["POST", /^\/api\/results$/, postResult],
  ["GET", /^\/api\/covers\/review$/, getReviews],
  ["POST", /^\/api\/covers\/review$/, postReview],
];

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}`);
  const route = routes.find(([method, pattern]) => method === req.method && pattern.test(url.pathname));
  if (!route) return sendJson(res, 404, { error: "not_found" });
  const [method, pattern, handler] = route;
  if (method !== "GET") {
    // JSON obligatoire (impose un preflight CORS, que ce serveur n'accorde jamais) et même origine
    // que la page du jeu : un autre site ouvert dans le navigateur ne peut pas écrire.
    if (!req.headers["content-type"]?.startsWith("application/json") || !isSameOrigin(req.headers.origin, req.headers.host)) {
      return sendJson(res, 403, { error: "forbidden" });
    }
  }
  try {
    await handler(req, res, pattern.exec(url.pathname)!.slice(1));
  } catch (err) {
    if (err instanceof HttpError) return sendJson(res, err.status, { error: err.code, message: err.message });
    console.error(`[server] ${url.pathname}:`, err);
    if (!res.headersSent) sendJson(res, 502, { error: "upstream_error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[server] proxy local sur http://${HOST}:${PORT}`);
});
