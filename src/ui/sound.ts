// Sons d'ambiance synthétisés (Web Audio) : aucun fichier audio à charger.
import type { Judgment } from "../types.ts";

const STORAGE_KEY = "megaquiz.sound";
let context: AudioContext | null = null;
let enabled = readEnabled();
/** Multiplicateur des volumes de base des notes ; le réglage « Sons du jeu » à 100 % vaut ×2. */
const MAX_EFFECTS_GAIN = 2;
let effectsGain = 1;

/** Volume des sons du jeu, de 0 à 1 (réglage de l'écran de configuration). */
export function setEffectsVolume(volume: number): void {
  effectsGain = Math.min(1, Math.max(0, volume)) * MAX_EFFECTS_GAIN;
}

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function soundEnabled(): boolean {
  return enabled;
}

export function toggleSound(): boolean {
  enabled = !enabled;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // préférence non mémorisée : sans importance
  }
  return enabled;
}

/** Contexte audio créé à la demande (le navigateur l'autorise après un clic sur « Lancer la partie »). */
function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Une note brève : fréquence, début (s, relatif), durée (s), volume, forme d'onde. */
function note(freq: number, start: number, duration: number, volume = 0.15, type: OscillatorType = "sine"): void {
  const peak = volume * effectsGain;
  const ctx = peak > 0 ? audio() : null;
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/** Tic de chronomètre ; plus aigu et plus présent sur les dernières secondes. */
export function tick(urgent: boolean): void {
  note(urgent ? 1320 : 880, 0, 0.05, urgent ? 0.12 : 0.06, "square");
}

/** Révélation : petit arpège montant. */
export function revealSound(): void {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.07, 0.25, 0.12, "triangle"));
}

/** Jugement : « ding » pour un joueur, « ding » à trois notes pour plusieurs, son grave pour personne. */
export function judgmentSound(judgment: Judgment): void {
  if (!judgment.length) {
    note(220, 0, 0.25, 0.12, "sine");
    note(174.6, 0.12, 0.3, 0.1, "sine");
    return;
  }
  note(987.77, 0, 0.18, 0.13, "triangle");
  note(1318.5, 0.08, 0.3, 0.13, "triangle");
  if (judgment.length > 1) note(1567.98, 0.18, 0.35, 0.12, "triangle");
}
