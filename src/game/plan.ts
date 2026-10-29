import { shuffle, type Rng } from "./random.ts";

/**
 * Construit la séquence des thèmes d'une partie : répartition équilibrée
 * (écart d'au plus 1 question entre thèmes), ordre aléatoire, en évitant
 * autant que possible deux questions consécutives du même thème.
 */
export function planThemes(themeIds: readonly string[], count: number, rng: Rng = Math.random): string[] {
  if (!themeIds.length || count <= 0) return [];
  const base = Math.floor(count / themeIds.length);
  const extra = new Set(shuffle(themeIds, rng).slice(0, count % themeIds.length));
  const remaining = new Map(themeIds.map((id) => [id, base + (extra.has(id) ? 1 : 0)]));

  // Tirage pondéré par le nombre restant, en excluant le thème précédent quand c'est possible.
  const sequence: string[] = [];
  for (let i = 0; i < count; i++) {
    const prev = sequence[sequence.length - 1];
    let pool = [...remaining].filter(([, n]) => n > 0);
    const withoutPrev = pool.filter(([id]) => id !== prev);
    // Si un thème domine, il faut le placer dès que possible pour ne pas finir en rafale.
    const left = count - i;
    const urgent = withoutPrev.find(([, n]) => n * 2 > left);
    if (urgent) pool = [urgent];
    else if (withoutPrev.length) pool = withoutPrev;

    const total = pool.reduce((sum, [, n]) => sum + n, 0);
    let roll = rng() * total;
    let chosen = pool[pool.length - 1][0];
    for (const [id, n] of pool) {
      roll -= n;
      if (roll < 0) {
        chosen = id;
        break;
      }
    }
    sequence.push(chosen);
    remaining.set(chosen, remaining.get(chosen)! - 1);
  }
  return sequence;
}

/** Un thème placé à intervalle fixe (ex. culture générale toutes les 5 questions). */
export interface Rhythm {
  theme: string;
  every: number;
}

/**
 * Plan avec rythme : le thème du rythme occupe les places every, 2·every…, les autres thèmes se
 * partagent équitablement le reste. Sans rythme applicable (thème absent ou seul), plan ordinaire.
 */
export function planWithRhythm(themeIds: readonly string[], count: number, rhythm: Rhythm | null, rng: Rng = Math.random): string[] {
  if (!rhythm || rhythm.every < 2 || !themeIds.includes(rhythm.theme) || themeIds.length < 2) return planThemes(themeIds, count, rng);
  const slots = Math.floor(count / rhythm.every);
  const others = planThemes(
    themeIds.filter((id) => id !== rhythm.theme),
    count - slots,
    rng,
  );
  return Array.from({ length: count }, (_, i) => ((i + 1) % rhythm.every === 0 ? rhythm.theme : others.shift()!));
}
