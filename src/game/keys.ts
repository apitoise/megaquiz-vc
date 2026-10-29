import type { KeyboardLayout } from "./preferences.ts";

/** Touches dont la lettre imprimée diffère entre AZERTY et la position physique QWERTY (`event.code`). */
const AZERTY_KEYCAPS: Record<string, string> = { KeyQ: "a", KeyA: "q", KeyW: "z", KeyZ: "w", Semicolon: "m", KeyM: "," };

/**
 * Lettre imprimée sur la touche pressée, selon la disposition choisie dans les réglages, quelle que soit
 * la disposition configurée dans le système (un clavier QWERTY réglé en français, par exemple).
 * Les chiffres de la rangée du haut et du pavé numérique donnent « 1 »… « 9 », même sans Maj en AZERTY.
 * Sans `code` exploitable (clavier virtuel…), on se rabat sur `event.key`.
 */
export function keycap(event: { key: string; code?: string }, layout: KeyboardLayout): string {
  const code = event.code ?? "";
  if (layout === "azerty" && code in AZERTY_KEYCAPS) return AZERTY_KEYCAPS[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^(Digit|Numpad)\d$/.test(code)) return code.slice(-1);
  if (code === "Space") return " ";
  return event.key;
}

export type Action =
  /** Espace / Entrée : révéler, puis valider les joueurs cochés (`all` : pour toutes les lignes). */
  | { type: "confirm"; all: boolean }
  /** 1 à 8 : coche ou décoche ce joueur. */
  | { type: "toggle"; player: number }
  | { type: "nobody" }
  | { type: "everyone" }
  | { type: "pause" }
  | { type: "broken" }
  | { type: "replay" }
  | { type: "fullscreen" }
  | { type: "sound" };

/** Traduit une touche (lettre imprimée, voir `keycap`) en action. */
export function keyToAction(key: string, shiftKey: boolean): Action | null {
  if (key === " " || key === "Spacebar" || key === "Enter") return { type: "confirm", all: shiftKey };
  if (/^[1-9]$/.test(key)) return { type: "toggle", player: Number(key) - 1 };
  switch (key.toLowerCase()) {
    case "n":
      return { type: "nobody" };
    case "t":
      return { type: "everyone" };
    case "p":
      return { type: "pause" };
    case "x":
      return { type: "broken" };
    case "r":
      return { type: "replay" };
    case "f":
      return { type: "fullscreen" };
    case "s":
      return { type: "sound" };
    default:
      return null;
  }
}
