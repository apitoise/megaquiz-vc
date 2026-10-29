import { PoolExhaustedError, type Question, type QuestionProvider } from "../types.ts";
import { planThemes } from "./plan.ts";
import type { Rng } from "./random.ts";

/** Ce qu'il faut pour jouer l'audio d'une question (un HTMLAudioElement en pratique). */
export interface Playable {
  currentTime: number;
  play(): Promise<void>;
  pause(): void;
}

/** Question dont le média est déjà chargé et prêt à s'afficher. */
export interface Prepared {
  question: Question;
  audio?: Playable;
}

export type Preloader = (question: Question) => Promise<Prepared>;

/** Nombre d'essais par question avant d'abandonner un thème qui échoue en boucle. */
const MAX_ATTEMPTS_PER_THEME = 4;

export interface SourceOptions {
  providers: QuestionProvider[];
  count: number;
  preload: Preloader;
  /** Ids à éviter si possible (historique des dernières parties). */
  recent: Set<string>;
  /** Ids à ne jamais reposer (blacklist). */
  blacklist: Set<string>;
  onNotice?: (message: string) => void;
  rng?: Rng;
}

/**
 * Fournit les questions d'une partie, dans l'ordre d'un plan de thèmes équilibré.
 * Garantit l'absence de doublon, remplace automatiquement une question dont le
 * média ne charge pas, et redistribue les questions d'un thème épuisé ou en panne.
 */
export class QuestionSource {
  private readonly providers: Map<string, QuestionProvider>;
  private readonly queue: string[];
  private readonly used = new Set<string>();
  private readonly options: SourceOptions;

  constructor(options: SourceOptions) {
    this.options = options;
    this.providers = new Map(options.providers.map((p) => [p.id, p]));
    this.queue = planThemes([...this.providers.keys()], options.count, options.rng);
  }

  /** Nombre de questions encore à fournir. */
  get remaining(): number {
    return this.queue.length;
  }

  /** Demande une question de plus (remplacement d'une question cassée). */
  requeue(themeId: string): void {
    if (!this.providers.size) return;
    this.queue.push(this.providers.has(themeId) ? themeId : [...this.providers.keys()][0]);
  }

  /** Marque un id comme utilisé dans cette partie (par ex. question dont le média a échoué en jeu). */
  markUsed(questionId: string): void {
    this.used.add(questionId);
  }

  /** Prochaine question préparée, ou `null` si plus aucun thème ne peut en fournir. */
  async next(): Promise<Prepared | null> {
    while (this.queue.length && this.providers.size) {
      const themeId = this.queue[0];
      const prepared = await this.fromTheme(themeId);
      if (prepared) {
        this.queue.shift();
        return prepared;
      }
      this.dropTheme(themeId);
    }
    this.queue.length = 0;
    return null;
  }

  private async fromTheme(themeId: string): Promise<Prepared | null> {
    const provider = this.providers.get(themeId)!;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_THEME; attempt++) {
      let question: Question;
      try {
        question = await this.draw(provider);
      } catch (err) {
        if (err instanceof PoolExhaustedError) return null;
        console.warn(`[${themeId}] tirage impossible`, err);
        continue;
      }
      this.used.add(question.id);
      try {
        return await this.options.preload(question);
      } catch (err) {
        console.warn(`[${themeId}] média indisponible pour ${question.id}`, err);
      }
    }
    return null;
  }

  /** Tire en évitant l'historique récent ; si le pool est trop petit, on le tolère. */
  private async draw(provider: QuestionProvider): Promise<Question> {
    const hard = new Set([...this.used, ...this.options.blacklist]);
    try {
      return await provider.next(new Set([...hard, ...this.options.recent]));
    } catch (err) {
      if (!(err instanceof PoolExhaustedError)) throw err;
      return provider.next(hard);
    }
  }

  private dropTheme(themeId: string): void {
    const label = this.providers.get(themeId)?.label ?? themeId;
    this.providers.delete(themeId);
    const lost = this.queue.filter((id) => id === themeId).length;
    const kept = this.queue.filter((id) => id !== themeId);
    const refill = planThemes([...this.providers.keys()], lost, this.options.rng);
    this.queue.splice(0, this.queue.length, ...interleave(kept, refill));
    this.options.onNotice?.(
      this.providers.size
        ? `Thème « ${label} » indisponible : ses questions sont redistribuées.`
        : `Thème « ${label} » indisponible.`,
    );
  }
}

/** Répartit `extra` régulièrement dans `base`. */
function interleave(base: string[], extra: string[]): string[] {
  if (!extra.length) return base;
  const out: string[] = [];
  const step = (base.length + extra.length) / extra.length;
  let e = 0;
  for (let i = 0; out.length < base.length + extra.length; i++) {
    if (e < extra.length && out.length >= Math.floor(e * step)) out.push(extra[e++]);
    else out.push(base[i - e]);
  }
  return out;
}
