import { describe, expect, it } from "vitest";
import { keycap, keyToAction } from "../src/game/keys.ts";

describe("keyToAction", () => {
  it("associe les touches aux actions", () => {
    expect(keyToAction(" ", false)).toEqual({ type: "confirm", all: false });
    expect(keyToAction("Enter", false)).toEqual({ type: "confirm", all: false });
    expect(keyToAction("n", false)).toEqual({ type: "nobody" });
    expect(keyToAction("t", false)).toEqual({ type: "everyone" });
    expect(keyToAction("p", false)).toEqual({ type: "pause" });
    expect(keyToAction("x", false)).toEqual({ type: "broken" });
    expect(keyToAction("r", false)).toEqual({ type: "replay" });
    expect(keyToAction("f", false)).toEqual({ type: "fullscreen" });
  });

  it("1 à 8 cochent un joueur", () => {
    expect(keyToAction("1", false)).toEqual({ type: "toggle", player: 0 });
    expect(keyToAction("5", false)).toEqual({ type: "toggle", player: 4 });
  });

  it("Maj + Espace valide pour toutes les lignes", () => {
    expect(keyToAction(" ", true)).toEqual({ type: "confirm", all: true });
  });

  it("ignore les autres touches", () => {
    expect(keyToAction("a", false)).toBeNull();
    expect(keyToAction("0", false)).toBeNull();
    expect(keyToAction("Escape", false)).toBeNull();
  });

  it("chiffres en AZERTY sans Maj (touche « & » = 1) et sur le pavé numérique", () => {
    expect(keycap({ key: "&", code: "Digit1" }, "azerty")).toBe("1");
    expect(keycap({ key: "(", code: "Digit5" }, "azerty")).toBe("5");
    expect(keycap({ key: "3", code: "Numpad3" }, "qwerty")).toBe("3");
    expect(keyToAction(keycap({ key: "é", code: "Digit2" }, "azerty"), false)).toEqual({ type: "toggle", player: 1 });
  });
});
