// Sauvegarde locale des résultats : saves/results.json (hors git), écrit par le serveur local.
// Plus durable que le localStorage du navigateur (qui disparaît si on vide le cache).
import { parseResult, type GameResult } from "../src/game/results.ts";
import { readJsonBody, readJsonFile, writeJsonFile } from "./json-file.ts";
import { HttpError, sendJson, type Handler } from "./respond.ts";

const FILE = process.env.RESULTS_FILE ?? "saves/results.json";

export async function readResults(file = FILE): Promise<GameResult[]> {
  const parsed = await readJsonFile(file);
  return Array.isArray(parsed) ? parsed.map(parseResult).filter((r): r is GameResult => r !== null) : [];
}

export async function appendResult(result: GameResult, file = FILE): Promise<GameResult[]> {
  const results = [...(await readResults(file)), result];
  await writeJsonFile(file, results);
  return results;
}

export const getResults: Handler = async (_req, res) => {
  sendJson(res, 200, await readResults());
};

export const postResult: Handler = async (req, res) => {
  const result = parseResult(await readJsonBody(req));
  if (!result) throw new HttpError(400, "invalid_result");
  sendJson(res, 201, await appendResult(result));
};
