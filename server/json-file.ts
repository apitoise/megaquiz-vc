// Fichiers JSON locaux du serveur (saves/…) : lecture tolérante, écriture atomique.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { dirname } from "node:path";
import { HttpError } from "./respond.ts";

/** Contenu JSON du fichier, ou `undefined` s'il n'existe pas encore. */
export async function readJsonFile(file: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return undefined;
  }
  return JSON.parse(raw) as unknown;
}

/** Écriture atomique (fichier temporaire puis renommage) : un arrêt brutal ne corrompt rien. */
export async function writeJsonFile(file: string, data: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, `${JSON.stringify(data, null, 1)}\n`);
  await rename(`${file}.tmp`, file);
}

/** Corps JSON d'une requête, limité en taille. */
export async function readJsonBody(req: IncomingMessage, maxBytes = 10_000): Promise<unknown> {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > maxBytes) throw new HttpError(413, "too_large");
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}
