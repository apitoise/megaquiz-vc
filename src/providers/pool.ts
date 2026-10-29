import { pickExcluding } from "../game/random.ts";
import { PoolExhaustedError, type Question, type QuestionProvider } from "../types.ts";

export interface PoolOptions<T> {
  id: string;
  label: string;
  /** Charge le pool (une seule fois). */
  load(): Promise<T[]>;
  /** Clé stable d'un élément ; l'id de question vaut « thème:clé ». */
  key(item: T): string;
  toQuestion(item: T, id: string): Question | Promise<Question>;
}

/** Thème fondé sur un pool d'éléments : tirage aléatoire hors exclusions. */
export function poolProvider<T>(options: PoolOptions<T>): QuestionProvider {
  let pool: T[] | null = null;
  const questionId = (item: T) => `${options.id}:${options.key(item)}`;
  return {
    id: options.id,
    label: options.label,
    async init() {
      pool ??= await options.load();
    },
    async next(exclude) {
      if (!pool) throw new Error(`Thème « ${options.id} » non initialisé`);
      const item = pickExcluding(pool, questionId, exclude);
      if (item === undefined) throw new PoolExhaustedError(options.id);
      return options.toQuestion(item, questionId(item));
    },
  };
}
