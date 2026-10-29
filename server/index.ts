// Serveur proxy local. Lié à 127.0.0.1 uniquement : il ne doit jamais être exposé sur le réseau.
import { createServer } from "node:http";
import { deezerTrack } from "./deezer.ts";
import { loadEnv } from "./env.ts";
import { HttpError, sendJson, type Handler } from "./respond.ts";
import { getResults, postResult } from "./results.ts";

loadEnv();

const HOST = "127.0.0.1";
const PORT = Number(process.env.SERVER_PORT ?? 8787);
/** Seules les pages servies en local peuvent écrire (un site web ouvert dans le navigateur ne doit pas pouvoir). */
const LOCAL_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

const routes: [string, RegExp, Handler][] = [
  ["GET", /^\/api\/health$/, (_req, res) => sendJson(res, 200, { ok: true })],
  ["GET", /^\/api\/deezer\/track\/(\d{1,20})$/, deezerTrack],
  ["GET", /^\/api\/results$/, getResults],
  ["POST", /^\/api\/results$/, postResult],
];

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}`);
  const route = routes.find(([method, pattern]) => method === req.method && pattern.test(url.pathname));
  if (!route) return sendJson(res, 404, { error: "not_found" });
  const [method, pattern, handler] = route;
  if (method !== "GET") {
    // JSON obligatoire (impose un preflight CORS, que ce serveur n'accorde jamais) et origine vérifiée.
    const origin = req.headers.origin;
    if (!req.headers["content-type"]?.startsWith("application/json") || (origin && !LOCAL_ORIGIN.test(origin))) {
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
