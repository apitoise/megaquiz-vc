import { describe, expect, it, vi } from "vitest";
import { seededRng } from "../src/game/random.ts";
import { QuestionSource, type SourceOptions } from "../src/game/source.ts";
import { fakeProvider, okPreload } from "./helpers.ts";

function source(options: Partial<SourceOptions> & Pick<SourceOptions, "providers" | "count">) {
  return new QuestionSource({
    preload: okPreload,
    recent: new Set(),
    blacklist: new Set(),
    rng: seededRng(42),
    ...options,
  });
}

async function drain(src: QuestionSource) {
  const ids: string[] = [];
  for (let p = await src.next(); p; p = await src.next()) ids.push(p.question.id);
  return ids;
}

describe("QuestionSource", () => {
  it("fournit le nombre demandé, sans doublon, réparti entre thèmes", async () => {
    const ids = await drain(source({ providers: [fakeProvider("a", 40), fakeProvider("b", 40)], count: 50 }));
    expect(ids).toHaveLength(50);
    expect(new Set(ids).size).toBe(50);
    expect(ids.filter((id) => id.startsWith("a:"))).toHaveLength(25);
  });

  it("évite l'historique récent tant que le pool le permet", async () => {
    const recent = new Set(["a:0", "a:1", "a:2"]);
    const ids = await drain(source({ providers: [fakeProvider("a", 10)], count: 7, recent }));
    expect(ids.some((id) => recent.has(id))).toBe(false);
  });

  it("retombe sur l'historique récent si le pool est trop petit", async () => {
    const recent = new Set(["a:0", "a:1", "a:2"]);
    const ids = await drain(source({ providers: [fakeProvider("a", 5)], count: 5, recent }));
    expect(new Set(ids).size).toBe(5);
  });

  it("n'utilise jamais la blacklist", async () => {
    const blacklist = new Set(["a:0", "a:1"]);
    const ids = await drain(source({ providers: [fakeProvider("a", 5)], count: 5, blacklist }));
    expect(ids).toHaveLength(3);
    expect(ids.some((id) => blacklist.has(id))).toBe(false);
  });

  it("redistribue les questions d'un thème épuisé", async () => {
    const onNotice = vi.fn();
    const ids = await drain(source({ providers: [fakeProvider("a", 2), fakeProvider("b", 50)], count: 20, onNotice }));
    expect(ids).toHaveLength(20);
    expect(ids.filter((id) => id.startsWith("a:"))).toHaveLength(2);
    expect(onNotice).toHaveBeenCalledOnce();
  });

  it("remplace une question dont le média ne charge pas", async () => {
    const preload = vi.fn(async (q) => {
      if (q.id === "a:0" || q.id === "a:3") throw new Error("404");
      return { question: q };
    });
    const ids = await drain(source({ providers: [fakeProvider("a", 10)], count: 8, preload }));
    expect(ids).toHaveLength(8);
    expect(ids).not.toContain("a:0");
    expect(ids).not.toContain("a:3");
  });

  it("abandonne un thème dont tous les médias échouent, sans bloquer", async () => {
    const preload = vi.fn(async (q) => {
      if (q.theme === "broken") throw new Error("réseau");
      return { question: q };
    });
    const ids = await drain(source({ providers: [fakeProvider("broken", 50), fakeProvider("ok", 50)], count: 10, preload }));
    expect(ids).toHaveLength(10);
    expect(ids.every((id) => id.startsWith("ok:"))).toBe(true);
  });

  it("s'arrête proprement quand plus aucun thème ne peut fournir", async () => {
    const ids = await drain(source({ providers: [fakeProvider("a", 3)], count: 10 }));
    expect(ids).toHaveLength(3);
  });

  it("requeue ajoute une question à fournir", async () => {
    const src = source({ providers: [fakeProvider("a", 10)], count: 2 });
    await src.next();
    src.requeue("a");
    expect(src.remaining).toBe(2);
  });
});
