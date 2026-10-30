import { afterEach, describe, expect, it, vi } from "vitest";
import { seededRng } from "../src/game/random.ts";
import { QuestionSource, RETRY_DELAY_MS, SUSPEND_MS, type SourceOptions } from "../src/game/source.ts";
import { poolProvider, workSubject } from "../src/providers/pool.ts";
import { fakeProvider, okPreload, question } from "./helpers.ts";

function source(options: Partial<SourceOptions> & Pick<SourceOptions, "providers" | "count">) {
  return new QuestionSource({
    preload: okPreload,
    lastAsked: new Map(),
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

  it("pose les questions jamais posées avant celles déjà vues", async () => {
    const lastAsked = new Map([
      ["a:0", 1],
      ["a:1", 2],
      ["a:2", 3],
    ]);
    const ids = await drain(source({ providers: [fakeProvider("a", 10)], count: 7, lastAsked }));
    expect(ids.some((id) => lastAsked.has(id))).toBe(false);
  });

  it("une fois le pool épuisé, ressort les questions les plus anciennes d'abord", async () => {
    const lastAsked = new Map([
      ["a:0", 3],
      ["a:1", 1],
      ["a:2", 2],
    ]);
    const ids = await drain(source({ providers: [fakeProvider("a", 5)], count: 5, lastAsked }));
    expect(ids.slice(2)).toEqual(["a:1", "a:2", "a:0"]);
  });

  it("ne pose pas deux fois la même œuvre dans une partie, même dans deux thèmes", async () => {
    const films = ["Titanic", "Alien"];
    const theme = (id: string) =>
      poolProvider<string>({
        id,
        label: id,
        load: async () => films,
        key: (name) => name,
        subject: (name) => workSubject("film", name),
        toQuestion: (name, qid) => ({ ...question(id, name), id: qid }),
      });
    const providers = [theme("posters"), theme("images")];
    await Promise.all(providers.map((p) => p.init()));
    const ids = await drain(source({ providers, count: 4 }));
    expect(ids).toHaveLength(2);
    expect(new Set(ids.map((id) => id.split(":")[1]))).toEqual(new Set(films));
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

describe("QuestionSource : pannes réseau", () => {
  afterEach(() => void vi.useRealTimers());

  it("attend le retour du réseau au lieu de terminer la partie", async () => {
    vi.useFakeTimers();
    let online = false;
    const preload = vi.fn(async (q) => {
      if (!online) throw new Error("hors ligne");
      return { question: q };
    });
    const src = source({ providers: [fakeProvider("a", 50)], count: 3, preload });
    const waiting = vi.fn();
    src.onWaiting = waiting;

    const pending = src.next();
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * 2);
    expect(waiting).toHaveBeenLastCalledWith(true);
    online = true;
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    expect(await pending).not.toBeNull();
    expect(waiting).toHaveBeenLastCalledWith(false);
  });

  it("met de côté un thème en panne puis le retente", async () => {
    vi.useFakeTimers();
    let aDown = true;
    const preload = vi.fn(async (q) => {
      if (q.theme === "a" && aDown) throw new Error("API en panne");
      return { question: q };
    });
    const onNotice = vi.fn();
    const src = source({ providers: [fakeProvider("a", 50), fakeProvider("b", 50)], count: 20, preload, onNotice });

    const first = [];
    for (let i = 0; i < 4; i++) first.push((await src.next())!.question.theme);
    expect(first.every((t) => t === "b")).toBe(true);
    expect(onNotice).toHaveBeenCalledWith(expect.stringContaining("ne répond pas"));

    aDown = false;
    vi.advanceTimersByTime(SUSPEND_MS);
    const later = [];
    for (let i = 0; i < 6; i++) later.push((await src.next())!.question.theme);
    expect(later).toContain("a");
  });

  it("dispose() interrompt l'attente", async () => {
    vi.useFakeTimers();
    const src = source({ providers: [fakeProvider("a", 50)], count: 3, preload: async () => Promise.reject(new Error("hors ligne")) });
    const pending = src.next();
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS / 2);
    src.dispose();
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    expect(await pending).toBeNull();
  });
});
