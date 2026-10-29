// Serveur proxy local. Lié à 127.0.0.1 uniquement : il ne doit jamais être exposé sur le réseau.
// Les proxys Deezer et IGDB s'ajouteront ici (étapes 3 et 4).
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadEnv } from "./env.ts";

loadEnv();

const HOST = "127.0.0.1";
const PORT = Number(process.env.SERVER_PORT ?? 8787);

type Handler = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void> | void;

const routes: Record<string, Handler> = {
  "/api/health": (_req, res) => sendJson(res, 200, { ok: true }),
};

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}`);
  const handler = routes[url.pathname];
  if (!handler) return sendJson(res, 404, { error: "not_found" });
  try {
    await handler(req, res, url);
  } catch (err) {
    console.error(`[server] ${url.pathname}:`, err);
    if (!res.headersSent) sendJson(res, 502, { error: "upstream_error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[server] proxy local sur http://${HOST}:${PORT}`);
});
