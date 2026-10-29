import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, GameStorage, HISTORY_GAMES, memoryStore } from "../src/game/storage.ts";

describe("GameStorage", () => {
  it("renvoie les réglages par défaut (50 questions, 20 s, Arthur et Marie)", () => {
    const settings = new GameStorage(memoryStore()).loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.questionCount).toBe(50);
    expect(settings.timerSeconds).toBe(20);
    expect(settings.players).toEqual(["Arthur", "Marie"]);
  });

  it("persiste les réglages", () => {
    const store = memoryStore();
    new GameStorage(store).saveSettings({ themes: ["flags"], questionCount: 10, timerSeconds: 15, players: ["A", "B"] });
    expect(new GameStorage(store).loadSettings()).toEqual({
      themes: ["flags"],
      questionCount: 10,
      timerSeconds: 15,
      players: ["A", "B"],
    });
  });

  it("résiste à un stockage corrompu", () => {
    const store = memoryStore();
    store.setItem("megaquiz.settings", "{pas du json");
    store.setItem("megaquiz.history", '"oups"');
    const storage = new GameStorage(store);
    expect(storage.loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(storage.recentQuestionIds().size).toBe(0);
  });

  it(`ne garde que les ${HISTORY_GAMES} dernières parties`, () => {
    const storage = new GameStorage(memoryStore());
    for (let game = 1; game <= HISTORY_GAMES + 1; game++) {
      storage.startGame();
      storage.recordAsked(`q${game}`);
    }
    const recent = storage.recentQuestionIds();
    expect(recent.has("q1")).toBe(false);
    for (let game = 2; game <= HISTORY_GAMES + 1; game++) expect(recent.has(`q${game}`)).toBe(true);
  });

  it("gère la blacklist", () => {
    const store = memoryStore();
    new GameStorage(store).addToBlacklist("flags:fr");
    new GameStorage(store).addToBlacklist("flags:fr");
    expect([...new GameStorage(store).blacklist()]).toEqual(["flags:fr"]);
  });

  it("remet à zéro la blacklist et l'historique", () => {
    const storage = new GameStorage(memoryStore());
    storage.addToBlacklist("flags:fr");
    storage.startGame();
    storage.recordAsked("music:1");
    storage.clearBlacklist();
    storage.clearHistory();
    expect(storage.blacklist().size).toBe(0);
    expect(storage.recentQuestionIds().size).toBe(0);
  });
});
