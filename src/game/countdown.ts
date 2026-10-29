/** Compte à rebours pausable. L'horloge est injectable pour les tests. */
export class Countdown {
  private readonly durationMs: number;
  private readonly onEnd: () => void;
  private readonly now: () => number;
  private remainingMs: number;
  private startedAt: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(durationMs: number, onEnd: () => void, now: () => number = () => performance.now()) {
    this.durationMs = durationMs;
    this.onEnd = onEnd;
    this.now = now;
    this.remainingMs = durationMs;
  }

  get running(): boolean {
    return this.startedAt !== null;
  }

  start(): void {
    if (this.running || this.remainingMs <= 0) return;
    this.startedAt = this.now();
    this.timer = setTimeout(() => {
      this.stop();
      this.remainingMs = 0;
      this.onEnd();
    }, this.remainingMs);
  }

  pause(): void {
    if (!this.running) return;
    this.remainingMs = this.remaining();
    this.stop();
  }

  /** Arrête définitivement (révélation anticipée). */
  cancel(): void {
    this.stop();
    this.remainingMs = 0;
  }

  remaining(): number {
    if (this.startedAt === null) return this.remainingMs;
    return Math.max(0, this.remainingMs - (this.now() - this.startedAt));
  }

  /** Fraction de temps restante, de 1 à 0. */
  fraction(): number {
    return this.durationMs > 0 ? this.remaining() / this.durationMs : 0;
  }

  private stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.startedAt = null;
  }
}
