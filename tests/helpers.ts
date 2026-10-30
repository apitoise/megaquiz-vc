import { leastRecent, pickExcluding } from "../src/game/random.ts";
import type { Prepared } from "../src/game/source.ts";
import { PoolExhaustedError, type Question, type QuestionProvider } from "../src/types.ts";

export function question(theme: string, n: number | string, answers = 1): Question {
  return {
    id: `${theme}:${n}`,
    theme,
    prompt: "?",
    media: { type: "image", src: `${theme}/${n}.png` },
    answers: Array.from({ length: answers }, (_, i) => ({ label: `L${i}`, value: `${theme}-${n}-${i}` })),
  };
}

/** Thème factice avec un pool de `size` questions. */
export function fakeProvider(id: string, size: number, answers = 1): QuestionProvider & { calls: number } {
  const pool = Array.from({ length: size }, (_, i) => question(id, i, answers));
  return {
    id,
    label: id,
    calls: 0,
    async init() {},
    async next(exclude, lastAsked = new Map()) {
      this.calls++;
      const q = pickExcluding(leastRecent(pool.filter((x) => !exclude.has(x.id)), (x) => x.id, lastAsked), (x) => x.id, exclude);
      if (!q) throw new PoolExhaustedError(id);
      return q;
    },
  };
}

export const okPreload = async (q: Question): Promise<Prepared> => ({ question: q });
