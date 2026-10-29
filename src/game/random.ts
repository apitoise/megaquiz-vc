export type Rng = () => number;

export function randomInt(max: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * max);
}

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Tire un élément au hasard dont la clé n'est pas exclue, ou `undefined`. */
export function pickExcluding<T>(
  items: readonly T[],
  key: (item: T) => string,
  exclude: Set<string>,
  rng: Rng = Math.random,
): T | undefined {
  const candidates = items.filter((item) => !exclude.has(key(item)));
  return candidates.length ? candidates[randomInt(candidates.length, rng)] : undefined;
}

/** Générateur déterministe (mulberry32), pour les tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
