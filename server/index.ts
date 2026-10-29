// Serveur proxy local. Lié à 127.0.0.1 uniquement : il ne doit jamais être exposé sur le réseau.
import { createServer } from "node:http";
import { deezerTrack } from "./deezer.ts";
import { loadEnv } from "./env.ts";
import { HttpError, sendJson, type Handler } from "./respond.ts";

loadEnv();

const HOST = "127.0.0.1";
const PORT = Number(process.env.SERVER_PORT ?? 8787);

const routes: [RegExp, Handler][] = [
  [/^\/api\/health$/, (_req, res) => sendJson(res, 200, { ok: true })],
  [/^\/api\/deezer\/track\/(\d{1,20})$/, deezerTrack],
];

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}`);
  const route = req.method === "GET" ? routes.find(([pattern]) => pattern.test(url.pathname)) : undefined;
  if (!route) return sendJson(res, 404, { error: "not_found" });
  const [pattern, handler] = route;
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
