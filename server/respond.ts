import type { IncomingMessage, ServerResponse } from "node:http";

/** Gestionnaire de route ; `params` contient les groupes capturés par le motif de la route. */
export type Handler = (req: IncomingMessage, res: ServerResponse, params: string[]) => Promise<void> | void;

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

/** Erreur à renvoyer telle quelle au navigateur (statut + code court). */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message = code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
