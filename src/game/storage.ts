import { MAX_PLAYERS, MIN_PLAYERS, type Settings } from "../types.ts";
import { sanitizePreferences, type Preferences } from "./preferences.ts";

/** Sous-ensemble de l'API Storage, pour pouvoir tester avec un stockage en mémoire. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEYS = {
  settings: "megaquiz.settings",
  history: "megaquiz.history",
  blacklist: "megaquiz.blacklist",
  preferences: "megaquiz.preferences",
} as const;

/** Nom proposé pour le n-ième joueur (0-based) quand on augmente le nombre de joueurs. */
export function defaultPlayerName(index: number): string {
  return DEFAULT_SETTINGS.players[index] ?? `Joueur ${index + 1}`;
}

/** Nombre de parties récentes dont on évite de reposer les questions. */
export const HISTORY_GAMES = 3;

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

  /** Historique : une liste d'ids de questions par partie, la plus récente en dernier. */
  private loadHistory(): string[][] {
    const history = readJson<unknown>(this.store, KEYS.history, []);
    return Array.isArray(history) ? history.filter(Array.isArray) : [];
  }

  /** Ouvre une nouvelle entrée d'historique (on ne garde que les dernières parties). */
  startGame(): void {
    const history = [...this.loadHistory(), []].slice(-HISTORY_GAMES);
    writeJson(this.store, KEYS.history, history);
  }

  /** Ajoute une question posée à la partie en cours. */
  recordAsked(questionId: string): void {
    const history = this.loadHistory();
    if (!history.length) history.push([]);
    history[history.length - 1].push(questionId);
    writeJson(this.store, KEYS.history, history.slice(-HISTORY_GAMES));
  }

  /** Ids posés lors des dernières parties (partie en cours comprise). */
  recentQuestionIds(): Set<string> {
    return new Set(this.loadHistory().flat());
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
    writeJson(this.store, KEYS.history, []);
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
