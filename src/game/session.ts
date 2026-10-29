import type { Judgment, Settings } from "../types.ts";
import { Countdown } from "./countdown.ts";
import { computeScores, isRoundComplete, judgeAll, judgeRow, newRound, nextPendingRow, togglePlayer, type Round } from "./scoring.ts";
import type { Prepared, QuestionSource } from "./source.ts";
import type { GameStorage } from "./storage.ts";

/** Délai entre le dernier jugement et la question suivante (le temps de voir le point attribué). */
export const ADVANCE_DELAY_MS = 600;

export type Phase = "loading" | "question" | "reveal" | "advancing" | "finished";

export interface SessionHooks {
  onNotice?: (message: string) => void;
  now?: () => number;
}

/**
 * Départ effectif d'un extrait : l'offset prévu, avancé si besoin pour que le timer
 * tienne dans l'extrait (timer réglé au-delà de 20 s avec un extrait de 30 s).
 */
export function audioStart(startAt: number, duration: number | undefined, timerSeconds: number): number {
  if (!duration || !Number.isFinite(duration)) return startAt;
  return Math.max(0, Math.min(startAt, duration - timerSeconds));
}

/** Une partie en cours : enchaîne les questions, gère le timer, la révélation et les jugements. */
export class GameSession {
  phase: Phase = "loading";
  paused = false;
  current: Prepared | null = null;
  round: Round | null = null;
  /** Ligne de réponse qui reçoit le prochain jugement clavier. */
  focusRow = 0;
  /** Joueurs cochés pour la ligne `focusRow`, pas encore validés. */
  selection: Judgment = [];
  readonly rounds: Round[] = [];
  /** Plus aucun thème ne répond : la partie attend le retour du réseau. */
  waiting = false;
  /** Partie arrêtée avec « Terminer » (elle ne compte pas au classement). */
  endedByUser = false;

  /** Départ effectif de l'extrait audio en cours (ajusté à la durée du timer). */
  private startAt = 0;
  private countdown: Countdown | null = null;
  private upcoming: Promise<Prepared | null> | null = null;
  private advanceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<() => void>();
  readonly settings: Settings;
  private readonly source: QuestionSource;
  private readonly storage: GameStorage;
  private readonly hooks: SessionHooks;

  constructor(settings: Settings, source: QuestionSource, storage: GameStorage, hooks: SessionHooks = {}) {
    this.settings = settings;
    this.source = source;
    this.storage = storage;
    this.hooks = hooks;
    source.onWaiting = (waiting) => {
      if (this.waiting === waiting) return;
      this.waiting = waiting;
      this.emit();
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Numéro de la question affichée (1-based). */
  get number(): number {
    return this.rounds.length + (this.round && this.phase !== "advancing" ? 1 : 0);
  }

  get total(): number {
    return this.phase === "finished" ? this.rounds.length : this.settings.questionCount;
  }

  get scores(): number[] {
    const rounds = this.round && this.phase === "reveal" ? [...this.rounds, this.round] : this.rounds;
    return computeScores(rounds, this.settings.players.length);
  }

  /** Fraction de temps restante (1 → 0) ; 0 une fois la réponse révélée. */
  timeFraction(): number {
    return this.phase === "question" && this.countdown ? this.countdown.fraction() : 0;
  }

  async start(): Promise<void> {
    this.storage.startGame();
    this.upcoming = this.source.next();
    await this.advance();
  }

  reveal(): void {
    if (this.phase !== "question" || this.paused) return;
    this.countdown?.cancel();
    this.phase = "reveal";
    this.emit();
  }

  private get judging(): boolean {
    return this.phase === "reveal" && !this.paused && this.round !== null;
  }

  /** Coche ou décoche un joueur sur une ligne (par défaut celle qui a le focus) ; rien n'est encore validé. */
  toggle(player: number, row = this.focusRow): void {
    if (!this.judging || player < 0 || player >= this.settings.players.length) return;
    if (row !== this.focusRow) this.focus(row);
    this.selection = togglePlayer(this.selection, player);
    this.emit();
  }

  /** Valide la sélection de la ligne qui a le focus. */
  validate(): void {
    this.judge(this.selection);
  }

  /** Valide la sélection pour toutes les lignes (ex. titre et artiste trouvés par les mêmes joueurs). */
  validateAll(): void {
    this.judgeAll(this.selection);
  }

  /** Juge une ligne de réponse (par défaut celle qui a le focus clavier) : ces joueurs ont trouvé. */
  judge(judgment: Judgment, row = this.focusRow): void {
    if (!this.judging) return;
    this.round = judgeRow(this.round!, row, judgment);
    if (isRoundComplete(this.round)) return this.completeRound();
    this.focus(nextPendingRow(this.round, row + 1));
    this.emit();
  }

  judgeAll(judgment: Judgment): void {
    if (!this.judging) return;
    this.round = judgeAll(this.round!, judgment);
    this.completeRound();
  }

  /** Tous les joueurs ont trouvé la ligne. */
  everyone(): Judgment {
    return this.settings.players.map((_, i) => i);
  }

  private focus(row: number): void {
    this.focusRow = row;
    this.selection = this.round?.judgments[row] ?? [];
  }

  togglePause(): void {
    if (this.phase !== "question" && this.phase !== "reveal") return;
    this.paused = !this.paused;
    if (this.paused) {
      this.countdown?.pause();
      this.current?.audio?.pause();
    } else {
      if (this.phase === "question") this.countdown?.start();
      this.playAudio(false);
    }
    this.emit();
  }

  replay(): void {
    if ((this.phase !== "question" && this.phase !== "reveal") || this.paused) return;
    this.playAudio(true);
  }

  /** Question cassée : on la blackliste et on la remplace. */
  markBroken(): void {
    if (!this.current || (this.phase !== "question" && this.phase !== "reveal")) return;
    this.storage.addToBlacklist(this.current.question.id);
    this.hooks.onNotice?.("Question retirée définitivement.");
    this.replaceCurrent();
  }

  /** Le média a échoué pendant la question : on la remplace sans la blacklister. */
  mediaFailed(): void {
    if (!this.current || (this.phase !== "question" && this.phase !== "reveal")) return;
    this.hooks.onNotice?.("Média indisponible : question remplacée.");
    this.replaceCurrent();
  }

  /** Termine la partie immédiatement (questions déjà jugées conservées). */
  finish(byUser = false): void {
    if (this.phase === "finished") return;
    this.endedByUser = byUser;
    if (this.advanceTimer !== null) clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
    this.stopCurrent();
    this.upcoming = null;
    this.source.dispose();
    this.waiting = false;
    this.phase = "finished";
    this.emit();
  }

  private replaceCurrent(): void {
    this.source.requeue(this.current!.question.theme);
    this.upcoming ??= this.source.next();
    void this.advance();
  }

  private completeRound(): void {
    this.rounds.push(this.round!);
    this.phase = "advancing";
    this.emit();
    this.advanceTimer = setTimeout(() => {
      this.advanceTimer = null;
      void this.advance();
    }, ADVANCE_DELAY_MS);
  }

  private async advance(): Promise<void> {
    this.stopCurrent();
    this.phase = "loading";
    this.emit();

    const upcoming = this.upcoming;
    this.upcoming = null;
    const prepared = upcoming ? await upcoming.catch(() => null) : null;
    if (this.phase !== "loading") return; // partie terminée entre-temps
    if (!prepared) return this.finish();

    this.current = prepared;
    this.round = newRound(prepared.question);
    this.focusRow = 0;
    this.selection = [];
    this.paused = false;
    this.phase = "question";
    this.storage.recordAsked(prepared.question.id);
    this.countdown = new Countdown(this.settings.timerSeconds * 1000, () => this.reveal(), this.hooks.now);
    this.countdown.start();
    if (prepared.audio) {
      this.startAt = audioStart(prepared.question.media.startAt ?? 0, prepared.audio.duration, this.settings.timerSeconds);
      // Coupure réseau pendant la lecture d'une partie non encore téléchargée de l'extrait.
      prepared.audio.addEventListener?.("error", () => {
        if (this.current === prepared) this.mediaFailed();
      });
    }
    this.playAudio(true);

    // Préchargement de la question suivante pendant que celle-ci se joue.
    if (this.source.remaining > 0) this.upcoming = this.source.next();
    this.emit();
  }

  private playAudio(fromStart: boolean): void {
    const prepared = this.current;
    const audio = prepared?.audio;
    if (!audio) return;
    if (fromStart) audio.currentTime = this.startAt;
    audio.play().catch((err: unknown) => {
      const name = err instanceof Error ? err.name : "";
      // Une lecture interrompue par pause() n'est pas une panne.
      if (name === "AbortError" || this.current !== prepared) return;
      if (name === "NotAllowedError") {
        this.hooks.onNotice?.("Le navigateur bloque l'audio : appuyez sur [R] pour relancer l'extrait.");
        return;
      }
      console.warn("Lecture audio impossible", err);
      this.mediaFailed();
    });
  }

  private stopCurrent(): void {
    this.countdown?.cancel();
    this.countdown = null;
    this.current?.audio?.pause();
    this.current = null;
    this.round = null;
    this.paused = false;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
