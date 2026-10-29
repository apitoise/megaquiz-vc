import { describe, expect, it } from "vitest";
import { keyToAction } from "../src/game/keys.ts";

describe("keyToAction", () => {
  it("associe les touches aux actions", () => {
    expect(keyToAction(" ", false)).toEqual({ type: "reveal" });
    expect(keyToAction("a", false)).toEqual({ type: "judge", judgment: 0 });
    expect(keyToAction("m", false)).toEqual({ type: "judge", judgment: 1 });
    expect(keyToAction("n", false)).toEqual({ type: "judge", judgment: "none" });
    expect(keyToAction("p", false)).toEqual({ type: "pause" });
    expect(keyToAction("x", false)).toEqual({ type: "broken" });
    expect(keyToAction("r", false)).toEqual({ type: "replay" });
    expect(keyToAction("f", false)).toEqual({ type: "fullscreen" });
  });

  it("Shift+A / Shift+M donnent les deux points", () => {
    // Avec Shift, event.key vaut la majuscule.
    expect(keyToAction("A", true)).toEqual({ type: "judgeAll", judgment: 0 });
    expect(keyToAction("M", true)).toEqual({ type: "judgeAll", judgment: 1 });
  });

  it("Verr. Maj sans Shift reste un jugement simple", () => {
    expect(keyToAction("A", false)).toEqual({ type: "judge", judgment: 0 });
  });

  it("ignore les autres touches (dont « q », A en QWERTY physique)", () => {
    expect(keyToAction("q", false)).toBeNull();
    expect(keyToAction("Enter", false)).toBeNull();
  });
});
