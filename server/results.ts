// Sauvegarde locale des résultats : saves/results.json (hors git), écrit par le serveur local.
// Plus durable que le localStorage du navigateur (qui disparaît si on vide le cache).
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseResult, type GameResult } from "../src/game/results.ts";
import { HttpError, sendJson, type Handler } from "./respond.ts";

const FILE = process.env.RESULTS_FILE ?? "saves/results.json";
const MAX_BODY_BYTES = 10_000;

export async function readResults(file = FILE): Promise<GameResult[]> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? parsed.map(parseResult).filter((r): r is GameResult => r !== null) : [];
}

/** Écriture atomique (fichier temporaire puis renommage) : un arrêt brutal ne corrompt pas l'historique. */
export async function appendResult(result: GameResult, file = FILE): Promise<GameResult[]> {
  const results = [...(await readResults(file)), result];
  await mkdir(dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, `${JSON.stringify(results, null, 1)}\n`);
  await rename(`${file}.tmp`, file);
  return results;
}

export const getResults: Handler = async (_req, res) => {
  sendJson(res, 200, await readResults());
};

export const postResult: Handler = async (req, res) => {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY_BYTES) throw new HttpError(413, "too_large");
  }
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  const result = parseResult(value);
  if (!result) throw new HttpError(400, "invalid_result");
  sendJson(res, 201, await appendResult(result));
};
