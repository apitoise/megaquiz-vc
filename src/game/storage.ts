import { MAX_PLAYERS, MIN_PLAYERS, type Settings } from "../types.ts";
import { sanitizePreferences, type Preferences } from "./preferences.ts";

/** Sous-ensemble de l'API Storage, pour pouvoir tester avec un stockage en mémoire. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEYS = {
  settings: "megaquiz.settings",
  /** Ancien format (ids des 3 dernières parties), repris au premier chargement. */
  legacyHistory: "megaquiz.history",
  asked: "megaquiz.asked",
  blacklist: "megaquiz.blacklist",
  preferences: "megaquiz.preferences",
} as const;

interface AskedHistory {
  game: number;
  asked: Record<string, number>;
}

/** Nom proposé pour le n-ième joueur (0-based) quand on augmente le nombre de joueurs. */
export function defaultPlayerName(index: number): string {
  return DEFAULT_SETTINGS.players[index] ?? `Joueur ${index + 1}`;
}

export const DEFAULT_SETTINGS: Settings = {
  themes: [],
  questionCount: 50,
  timerSeconds: 20,
  players: ["Arthur", "Marie"],
};

function readJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  try {
    const raw = store.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeJson(store: KeyValueStore, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage plein ou indisponible : on joue quand même, sans persistance.
  }
}

export class GameStorage {
  private readonly store: KeyValueStore;

  constructor(store: KeyValueStore) {
    this.store = store;
  }

  loadSettings(): Settings {
    const saved = readJson<Partial<Settings>>(this.store, KEYS.settings, {});
    return {
      themes: Array.isArray(saved.themes) ? saved.themes : DEFAULT_SETTINGS.themes,
      questionCount: positiveInt(saved.questionCount, DEFAULT_SETTINGS.questionCount),
      timerSeconds: positiveInt(saved.timerSeconds, DEFAULT_SETTINGS.timerSeconds),
      players:
        Array.isArray(saved.players) && saved.players.length >= MIN_PLAYERS && saved.players.length <= MAX_PLAYERS
          ? saved.players.map(String)
          : DEFAULT_SETTINGS.players,
    };
  }

  saveSettings(settings: Settings): void {
    writeJson(this.store, KEYS.settings, settings);
  }

  loadPreferences(): Preferences {
    return sanitizePreferences(readJson<unknown>(this.store, KEYS.preferences, {}));
  }

  savePreferences(preferences: Preferences): void {
    writeJson(this.store, KEYS.preferences, preferences);
  }

  /** Historique : numéro de la partie en cours et, par id, la dernière partie où la question a été posée. */
  private loadAsked(): AskedHistory {
    const saved = readJson<Partial<AskedHistory> | null>(this.store, KEYS.asked, null);
    if (saved && typeof saved === "object" && saved.asked && typeof saved.asked === "object") {
      return { game: positiveInt(saved.game, 0), asked: { ...saved.asked } };
    }
    // Ancien historique (une liste d'ids par partie, la plus récente en dernier) : on le reprend.
    const legacy = readJson<unknown>(this.store, KEYS.legacyHistory, []);
    const games = Array.isArray(legacy) ? legacy.filter(Array.isArray) : [];
    const asked: Record<string, number> = {};
    games.forEach((ids, i) => ids.forEach((id) => (asked[String(id)] = i + 1)));
    return { game: games.length, asked };
  }

  /** Commence une nouvelle partie (une partie abandonnée n'efface rien de l'historique). */
  startGame(): void {
    const history = this.loadAsked();
    writeJson(this.store, KEYS.asked, { ...history, game: history.game + 1 });
  }

  /** Note qu'une question vient d'être posée dans la partie en cours. */
  recordAsked(questionId: string): void {
    const history = this.loadAsked();
    history.asked[questionId] = Math.max(history.game, 1);
    writeJson(this.store, KEYS.asked, history);
  }

  /** Par id, le numéro de la dernière partie où la question a été posée (absent = jamais posée). */
  lastAsked(): Map<string, number> {
    return new Map(Object.entries(this.loadAsked().asked).filter(([, game]) => typeof game === "number"));
  }

  blacklist(): Set<string> {
    const list = readJson<unknown>(this.store, KEYS.blacklist, []);
    return new Set(Array.isArray(list) ? list.map(String) : []);
  }

  addToBlacklist(questionId: string): void {
    const list = this.blacklist();
    list.add(questionId);
    writeJson(this.store, KEYS.blacklist, [...list]);
  }

  clearBlacklist(): void {
    writeJson(this.store, KEYS.blacklist, []);
  }

  clearHistory(): void {
    writeJson(this.store, KEYS.asked, { game: 0, asked: {} });
    writeJson(this.store, KEYS.legacyHistory, []);
  }
}

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

/** Stockage en mémoire, utilisé si localStorage est indisponible et dans les tests. */
export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}
