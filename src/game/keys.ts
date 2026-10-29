import type { Judgment } from "../types.ts";

export type Action =
  | { type: "reveal" }
  | { type: "judge"; judgment: Judgment }
  | { type: "judgeAll"; judgment: Judgment }
  | { type: "pause" }
  | { type: "broken" }
  | { type: "replay" }
  | { type: "fullscreen" }
  | { type: "sound" };

/**
 * Traduit une touche en action. On s'appuie sur `event.key` (et non `event.code`)
 * pour respecter la disposition AZERTY.
 */
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
