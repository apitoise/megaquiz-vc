// Préférences de l'appareil (indépendantes d'une partie) : disposition du clavier et volumes.

export type KeyboardLayout = "azerty" | "qwerty";

/** Canal de volume : les sons du jeu (« effects ») ou un thème qui joue de l'audio (par son id). */
export const EFFECTS = "effects";
/** Thèmes dont les questions sont des extraits audio. */
export const AUDIO_THEMES = ["music", "ost", "film-music", "series-music", "generiques"] as const;

export interface Preferences {
  keyboard: KeyboardLayout;
  /** Volume par canal, en pourcentage (0 à 100). */
  volumes: Record<string, number>;
}

export const DEFAULT_PREFERENCES: Preferences = {
  keyboard: "azerty",
  volumes: {
    // Les sons du jeu étaient un peu discrets, les titres du thème musique (mastering radio) un peu forts.
    [EFFECTS]: 70,
    music: 65,
    ost: 100,
    "film-music": 100,
    "series-music": 100,
    generiques: 100,
  },
};

/** Préférences relues depuis le stockage : tout champ absent ou invalide reprend sa valeur par défaut. */
export function sanitizePreferences(saved: unknown): Preferences {
  const raw = (saved && typeof saved === "object" ? saved : {}) as Partial<Preferences>;
  const volumes = { ...DEFAULT_PREFERENCES.volumes };
  if (raw.volumes && typeof raw.volumes === "object") {
    for (const [channel, value] of Object.entries(raw.volumes)) {
      if (typeof value === "number" && Number.isFinite(value)) volumes[channel] = clampPercent(value);
    }
  }
  return { keyboard: raw.keyboard === "qwerty" ? "qwerty" : "azerty", volumes };
}

/** Volume d'un canal, de 0 à 1 (100 % pour un canal inconnu). */
export function volumeOf(preferences: Preferences, channel: string): number {
  return (preferences.volumes[channel] ?? 100) / 100;
}

function clampPercent(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)));
}
