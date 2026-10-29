import { pickExcluding, randomInt, type Rng } from "../game/random.ts";
import { PoolExhaustedError, type Question, type QuestionProvider } from "../types.ts";

export interface PoolOptions<T> {
  id: string;
  label: string;
  /** Charge le pool (une seule fois). */
  load(): Promise<T[]>;
  /** Clé stable d'un élément ; l'id de question vaut « thème:clé ». */
  key(item: T): string;
  toQuestion(item: T, id: string): Question | Promise<Question>;
  /**
   * Groupe d'un élément (continent, style musical, catégorie…). Si fourni, le tirage choisit
   * d'abord un groupe au hasard (à parts égales), puis un élément : les groupes nombreux ne
   * dominent plus la partie, et on évite deux questions d'affilée du même groupe.
   */
  group?(item: T): string;
}

/** Thème fondé sur un pool d'éléments : tirage aléatoire hors exclusions. */
export function poolProvider<T>(options: PoolOptions<T>): QuestionProvider {
  let pool: T[] | null = null;
  let lastGroup: string | null = null;
  const questionId = (item: T) => `${options.id}:${options.key(item)}`;
  return {
    id: options.id,
    label: options.label,
    async init() {
      pool ??= await options.load();
    },
    invalidate() {
      pool = null;
    },
    async next(exclude) {
      if (!pool) throw new Error(`Thème « ${options.id} » non initialisé`);
      let item: T | undefined;
      if (options.group) {
        const picked = pickBalanced(pool, questionId, options.group, exclude, lastGroup);
        item = picked?.item;
        lastGroup = picked?.group ?? lastGroup;
      } else {
        item = pickExcluding(pool, questionId, exclude);
      }
      if (item === undefined) throw new PoolExhaustedError(options.id);
      return options.toQuestion(item, questionId(item));
    },
  };
}

/**
 * Tirage équilibré : un groupe au hasard parmi ceux qui ont encore des éléments disponibles
 * (en évitant `avoid` si un autre groupe existe), puis un élément au hasard dans ce groupe.
 */
export function pickBalanced<T>(
  items: readonly T[],
  key: (item: T) => string,
  group: (item: T) => string,
  exclude: Set<string>,
  avoid: string | null,
  rng: Rng = Math.random,
): { item: T; group: string } | undefined {
  const byGroup = new Map<string, T[]>();
  for (const item of items) {
    if (exclude.has(key(item))) continue;
    const g = group(item);
    byGroup.set(g, [...(byGroup.get(g) ?? []), item]);
  }
  let groups = [...byGroup.keys()];
  if (!groups.length) return undefined;
  if (groups.length > 1 && avoid !== null) groups = groups.filter((g) => g !== avoid);
  const chosen = groups[randomInt(groups.length, rng)];
  const candidates = byGroup.get(chosen)!;
  return { item: candidates[randomInt(candidates.length, rng)], group: chosen };
}
