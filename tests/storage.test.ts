import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, GameStorage, memoryStore } from "../src/game/storage.ts";

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
    expect(storage.lastAsked().size).toBe(0);
  });

  it("retient, pour chaque question, la dernière partie où elle a été posée", () => {
    const storage = new GameStorage(memoryStore());
    for (let game = 1; game <= 10; game++) {
      storage.startGame();
      storage.recordAsked(`q${game}`);
    }
    storage.startGame();
    storage.recordAsked("q1");
    const lastAsked = storage.lastAsked();
    expect(lastAsked.size).toBe(10);
    expect(lastAsked.get("q1")).toBe(11);
    expect(lastAsked.get("q2")).toBe(2);
  });

  it("une partie abandonnée n'efface pas l'historique", () => {
    const storage = new GameStorage(memoryStore());
    storage.startGame();
    storage.recordAsked("q1");
    for (let i = 0; i < 5; i++) storage.startGame();
    expect(storage.lastAsked().get("q1")).toBe(1);
  });

  it("reprend l'ancien historique (une liste d'ids par partie)", () => {
    const store = memoryStore();
    store.setItem("megaquiz.history", JSON.stringify([["a", "b"], ["c"]]));
    const storage = new GameStorage(store);
    expect([...storage.lastAsked()]).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 2],
    ]);
    storage.startGame();
    storage.recordAsked("d");
    expect(storage.lastAsked().get("d")).toBe(3);
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
    expect(storage.lastAsked().size).toBe(0);
  });
});
