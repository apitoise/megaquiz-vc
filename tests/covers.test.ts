import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { coverChoice, type CoverEntry, type CoverManifest } from "../src/data/covers.ts";

const entry = (status: CoverEntry["status"], anonymized = true): CoverEntry => ({
  game: "Jeu",
  gameId: 1,
  status,
  flags: status === "sure" ? [] : ["titre-non-detecte"],
  anonymized,
  maskRatio: 0.1,
  text: [],
});

describe("coverChoice", () => {
  const manifest: CoverManifest = { sure: entry("sure"), doute: entry("a-verifier"), vierge: entry("sure", false) };

  it("sans anonymisation lancée, garde les originales", () => {
    expect(coverChoice("x", null, {})).toEqual({ kind: "original" });
  });

  it("pose la version anonymisée d'une jaquette sûre", () => {
    expect(coverChoice("sure", manifest, {})).toEqual({ kind: "anonymized" });
  });

  it("n'utilise une jaquette à vérifier qu'une fois validée", () => {
    expect(coverChoice("doute", manifest, {})).toBeNull();
    expect(coverChoice("doute", manifest, { doute: "ok" })).toEqual({ kind: "anonymized" });
  });

  it("ne pose jamais une jaquette rejetée", () => {
    expect(coverChoice("sure", manifest, { sure: "rejete" })).toBeNull();
    expect(coverChoice("x", null, { x: "rejete" })).toBeNull();
  });

  it("garde l'originale quand aucun texte n'a été trouvé", () => {
    expect(coverChoice("vierge", manifest, {})).toEqual({ kind: "original" });
  });
});

describe("décisions de relecture (serveur)", () => {
  it("ignore les entrées invalides du fichier", async () => {
    const dir = await mkdtemp(join(tmpdir(), "megaquiz-"));
    const file = join(dir, "covers-review.json");
    try {
      const { writeJsonFile } = await import("../server/json-file.ts");
      const { readReviews } = await import("../server/covers.ts");
      await writeJsonFile(file, { co1abc: "ok", co2def: "rejete", "../hack": "ok", co3: "peut-être" });
      expect(await readReviews(file)).toEqual({ co1abc: "ok", co2def: "rejete" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
