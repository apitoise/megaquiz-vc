import { describe, expect, it } from "vitest";
import { isSameOrigin } from "../server/origin.ts";

describe("isSameOrigin", () => {
  it("accepte la page du jeu, en local comme sur le réseau", () => {
    expect(isSameOrigin("http://127.0.0.1:5173", "127.0.0.1:5173")).toBe(true);
    expect(isSameOrigin("http://localhost:5173", "localhost:5173")).toBe(true);
    expect(isSameOrigin("http://192.168.1.108:5173", "192.168.1.108:5173")).toBe(true);
  });

  it("refuse une page d'un autre site ou d'un autre port", () => {
    expect(isSameOrigin("https://evil.example", "192.168.1.108:5173")).toBe(false);
    expect(isSameOrigin("http://192.168.1.50:5173", "192.168.1.108:5173")).toBe(false);
    expect(isSameOrigin("http://127.0.0.1:3000", "127.0.0.1:5173")).toBe(false);
    expect(isSameOrigin("null", "127.0.0.1:5173")).toBe(false);
  });

  it("accepte une requête sans Origin (pas une page web) et refuse un Host absent", () => {
    expect(isSameOrigin(undefined, "127.0.0.1:5173")).toBe(true);
    expect(isSameOrigin("http://127.0.0.1:5173", undefined)).toBe(false);
  });
});
