// Décisions de relecture des jaquettes anonymisées : saves/covers-review.json (hors git).
import { isCoverDecision, type CoverReviews } from "../src/data/covers.ts";
import { readJsonBody, readJsonFile, writeJsonFile } from "./json-file.ts";
import { HttpError, sendJson, type Handler } from "./respond.ts";

const FILE = process.env.COVERS_REVIEW_FILE ?? "saves/covers-review.json";
const IMAGE_ID = /^[a-z0-9]{1,40}$/;

export async function readReviews(file = FILE): Promise<CoverReviews> {
  const parsed = await readJsonFile(file);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter(([id, d]) => IMAGE_ID.test(id) && isCoverDecision(d))) as CoverReviews;
}

export const getReviews: Handler = async (_req, res) => {
  sendJson(res, 200, await readReviews());
};

/** Corps : { imageId, decision: "ok" | "rejete" | null } (null efface la décision). */
export const postReview: Handler = async (req, res) => {
  const body = (await readJsonBody(req)) as { imageId?: unknown; decision?: unknown } | null;
  const imageId = body?.imageId;
  const decision = body?.decision;
  if (typeof imageId !== "string" || !IMAGE_ID.test(imageId) || !(decision === null || isCoverDecision(decision))) {
    throw new HttpError(400, "invalid_review");
  }
  const reviews = await readReviews();
  if (decision === null) delete reviews[imageId];
  else reviews[imageId] = decision;
  await writeJsonFile(FILE, reviews);
  sendJson(res, 200, reviews);
};
