import { PoolExhaustedError, type Question, type QuestionProvider } from "../types.ts";
import { planThemes, planWithRhythm, type Rhythm } from "./plan.ts";
import type { Rng } from "./random.ts";

/** Ce qu'il faut pour jouer l'audio d'une question (un HTMLAudioElement en pratique). */
export interface Playable {
  currentTime: number;
  /** Durée en secondes (NaN tant qu'elle est inconnue). */
  duration?: number;
  addEventListener?(type: "error", listener: () => void): void;
  play(): Promise<void>;
  pause(): void;
}

/** Question dont le média est déjà chargé et prêt à s'afficher. */
export interface Prepared {
  question: Question;
  audio?: Playable;
}

export type Preloader = (question: Question) => Promise<Prepared>;

/** Nombre d'essais par question avant de mettre de côté un thème qui échoue en boucle. */
const MAX_ATTEMPTS_PER_THEME = 4;
/** Durée pendant laquelle un thème en échec (réseau, API) est mis de côté avant un nouvel essai. */
export const SUSPEND_MS = 20_000;
/** Délai entre deux essais quand plus aucun thème ne répond (connexion perdue). */
export const RETRY_DELAY_MS = 5_000;

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
  /** Thème placé à intervalle fixe (culture générale toutes les 5 questions). */
  rhythm?: Rhythm;
}

/**
 * Fournit les questions d'une partie, dans l'ordre d'un plan de thèmes équilibré.
 * Garantit l'absence de doublon et remplace automatiquement une question dont le
 * média ne charge pas. Un thème épuisé est abandonné (ses questions sont redistribuées) ;
 * un thème en panne est mis de côté un moment puis retenté. Si plus rien ne répond,
 * on attend le retour du réseau au lieu de terminer la partie.
 */
export class QuestionSource {
  private readonly providers: Map<string, QuestionProvider>;
  private readonly queue: string[];
  private readonly used = new Set<string>();
  private readonly options: SourceOptions;
  private readonly suspendedUntil = new Map<string, number>();
  private disposed = false;
  /** Prévenu quand la source attend le retour du réseau (true), puis quand ça repart (false). */
  onWaiting: ((waiting: boolean) => void) | null = null;

  constructor(options: SourceOptions) {
    this.options = options;
    this.providers = new Map(options.providers.map((p) => [p.id, p]));
    this.queue = planWithRhythm([...this.providers.keys()], options.count, options.rhythm ?? null, options.rng);
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

  /** Arrête toute attente en cours (fin de partie). */
  dispose(): void {
    this.disposed = true;
  }

  /** Prochaine question préparée, ou `null` si plus aucun thème ne peut en fournir. */
  async next(): Promise<Prepared | null> {
    while (this.queue.length && this.providers.size && !this.disposed) {
      let index = this.availableIndex();
      if (index < 0) {
        // Il ne reste que des thèmes en panne dans la file : un thème qui marche les remplace…
        const fallback = [...this.providers.keys()].find((id) => !this.isSuspended(id));
        if (!fallback) {
          // …et si plus rien ne marche, on attend le retour du réseau.
          await this.waitForRecovery();
          continue;
        }
        this.queue[0] = fallback;
        index = 0;
      }
      const themeId = this.queue[index];
      const result = await this.fromTheme(themeId);
      if (result === "exhausted") this.dropTheme(themeId);
      else if (result === "failed") this.suspend(themeId);
      else {
        this.queue.splice(index, 1);
        this.onWaiting?.(false);
        return result;
      }
    }
    if (!this.providers.size) this.queue.length = 0;
    return null;
  }

  /** Premier élément de la file dont le thème n'est pas mis de côté, ou -1. */
  private availableIndex(): number {
    return this.queue.findIndex((id) => !this.isSuspended(id));
  }

  private isSuspended(themeId: string): boolean {
    return (this.suspendedUntil.get(themeId) ?? 0) > Date.now();
  }

  private suspend(themeId: string): void {
    this.suspendedUntil.set(themeId, Date.now() + SUSPEND_MS);
    const label = this.providers.get(themeId)?.label ?? themeId;
    if ([...this.providers.keys()].some((id) => !this.isSuspended(id))) this.options.onNotice?.(`« ${label} » ne répond pas : on passe à d'autres thèmes pour l'instant.`);
  }

  /** Plus aucun thème disponible : on patiente, puis on retente tout le monde. */
  private async waitForRecovery(): Promise<void> {
    this.onWaiting?.(true);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    this.suspendedUntil.clear();
  }

  private async fromTheme(themeId: string): Promise<Prepared | "exhausted" | "failed"> {
    const provider = this.providers.get(themeId)!;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_THEME && !this.disposed; attempt++) {
      let question: Question;
      try {
        question = await this.draw(provider);
      } catch (err) {
        if (err instanceof PoolExhaustedError) return "exhausted";
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
    return "failed";
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
      this.providers.size ? `Plus de questions « ${label} » : elles sont remplacées par d'autres thèmes.` : `Plus de questions « ${label} ».`,
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
