import type { Judgment } from "../types.ts";
import type { KeyboardLayout } from "./preferences.ts";

/** Touches dont la lettre imprimée diffère entre AZERTY et la position physique QWERTY (`event.code`). */
const AZERTY_KEYCAPS: Record<string, string> = { KeyQ: "a", KeyA: "q", KeyW: "z", KeyZ: "w", Semicolon: "m", KeyM: "," };

/**
 * Lettre imprimée sur la touche pressée, selon la disposition choisie dans les réglages, quelle que soit
 * la disposition configurée dans le système (un clavier QWERTY réglé en français, par exemple).
 * Sans `code` exploitable (clavier virtuel…), on se rabat sur `event.key`.
 */
export function keycap(event: { key: string; code?: string }, layout: KeyboardLayout): string {
  const code = event.code ?? "";
  if (layout === "azerty" && code in AZERTY_KEYCAPS) return AZERTY_KEYCAPS[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (code === "Space") return " ";
  return event.key;
}

export type Action =
  | { type: "reveal" }
  | { type: "judge"; judgment: Judgment }
  | { type: "judgeAll"; judgment: Judgment }
  | { type: "pause" }
  | { type: "broken" }
  | { type: "replay" }
  | { type: "fullscreen" }
  | { type: "sound" };

/** Traduit une touche (lettre imprimée, voir `keycap`) en action. */
export function keyToAction(key: string, shiftKey: boolean): Action | null {
  if (key === " " || key === "Spacebar") return { type: "reveal" };
  switch (key.toLowerCase()) {
    case "a":
      return shiftKey ? { type: "judgeAll", judgment: 0 } : { type: "judge", judgment: 0 };
    case "m":
      return shiftKey ? { type: "judgeAll", judgment: 1 } : { type: "judge", judgment: 1 };
    case "n":
      return { type: "judge", judgment: "none" };
    case "d":
      // « Les deux » : réponse trouvée en même temps, un point chacun.
      return { type: "judge", judgment: "both" };
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
