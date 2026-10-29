import { describe, expect, it } from "vitest";
import { keycap, keyToAction } from "../src/game/keys.ts";
import { DEFAULT_PREFERENCES, volumeOf } from "../src/game/preferences.ts";
import { GameStorage, memoryStore } from "../src/game/storage.ts";

describe("keycap : lettre imprimée selon la disposition choisie", () => {
  it("AZERTY : la touche [A] (position Q du QWERTY) donne « a », [M] (point-virgule) donne « m »", () => {
    expect(keycap({ key: "a", code: "KeyQ" }, "azerty")).toBe("a");
    expect(keycap({ key: "m", code: "Semicolon" }, "azerty")).toBe("m");
    expect(keycap({ key: "q", code: "KeyA" }, "azerty")).toBe("q");
    expect(keycap({ key: "d", code: "KeyD" }, "azerty")).toBe("d");
  });

  it("QWERTY : la lettre de la touche, même si le système est réglé en français", () => {
    // Clavier QWERTY, système en AZERTY : la touche marquée A envoie « q ».
    expect(keycap({ key: "q", code: "KeyA" }, "qwerty")).toBe("a");
    expect(keycap({ key: ",", code: "KeyM" }, "qwerty")).toBe("m");
    expect(keyToAction(keycap({ key: "q", code: "KeyT" }, "qwerty"), false)).toEqual({ type: "everyone" });
  });

  it("Espace et touches sans code exploitable", () => {
    expect(keycap({ key: " ", code: "Space" }, "qwerty")).toBe(" ");
    expect(keycap({ key: "a", code: "" }, "qwerty")).toBe("a");
    expect(keycap({ key: "Enter", code: "Enter" }, "azerty")).toBe("Enter");
  });
});

describe("préférences (clavier, volumes)", () => {
  it("par défaut : AZERTY, musique moins forte que les OST", () => {
    const prefs = new GameStorage(memoryStore()).loadPreferences();
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
    expect(volumeOf(prefs, "music")).toBeLessThan(volumeOf(prefs, "ost"));
    expect(volumeOf(prefs, "inconnu")).toBe(1);
  });

  it("persiste et assainit les valeurs", () => {
    const store = memoryStore();
    new GameStorage(store).savePreferences({ keyboard: "qwerty", volumes: { effects: 30, music: 140 } });
    const prefs = new GameStorage(store).loadPreferences();
    expect(prefs.keyboard).toBe("qwerty");
    expect(prefs.volumes.effects).toBe(30);
    expect(prefs.volumes.music).toBe(100);
    expect(prefs.volumes.ost).toBe(DEFAULT_PREFERENCES.volumes.ost);
    store.setItem("megaquiz.preferences", '{"keyboard":"dvorak","volumes":{"music":"fort"}}');
    expect(new GameStorage(store).loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});
