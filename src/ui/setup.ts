import type { QuestionProvider, Settings } from "../types.ts";
import { h } from "./dom.ts";

/** Écran de configuration. Appelle `onStart` avec les réglages validés. */
export function renderSetup(
  root: HTMLElement,
  providers: QuestionProvider[],
  initial: Settings,
  onStart: (settings: Settings) => void,
): void {
  const known = new Set(providers.map((p) => p.id));
  const checked = new Set(initial.themes.filter((id) => known.has(id)));
  if (!checked.size) providers.forEach((p) => checked.add(p.id));

  const error = h("p", { class: "form-error", role: "alert" });
  const themeBoxes = providers.map((p) =>
    h(
      "label",
      { class: "theme-choice" },
      h("input", { type: "checkbox", name: "theme", value: p.id, checked: checked.has(p.id) }),
      h("span", {}, p.label),
    ),
  );
  const count = h("input", { type: "number", name: "count", min: 1, max: 500, value: initial.questionCount, required: true });
  const timer = h("input", { type: "number", name: "timer", min: 3, max: 120, value: initial.timerSeconds, required: true });
  const p1 = h("input", { type: "text", name: "p1", value: initial.players[0], maxlength: 20, required: true });
  const p2 = h("input", { type: "text", name: "p2", value: initial.players[1], maxlength: 20, required: true });

  const form = h(
    "form",
    { class: "setup" },
    h("h1", {}, "MégaQuiz"),
    h("fieldset", {}, h("legend", {}, "Thèmes"), h("div", { class: "theme-grid" }, ...themeBoxes)),
    h(
      "div",
      { class: "setup-row" },
      h("label", {}, "Nombre de questions", count),
      h("label", {}, "Durée du timer (s)", timer),
    ),
    h("div", { class: "setup-row" }, h("label", {}, "Joueur [A]", p1), h("label", {}, "Joueur [M]", p2)),
    error,
    h("button", { class: "action primary big", type: "submit" }, "Lancer la partie"),
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const themes = themeBoxes
      .map((label) => label.querySelector("input")!)
      .filter((input) => input.checked)
      .map((input) => input.value);
    if (!themes.length) {
      error.textContent = "Cochez au moins un thème.";
      return;
    }
    onStart({
      themes,
      questionCount: clampInt(count.value, 1, 500, 50),
      timerSeconds: clampInt(timer.value, 3, 120, 20),
      players: [p1.value.trim() || "Joueur 1", p2.value.trim() || "Joueur 2"],
    });
  });

  root.replaceChildren(form);
}

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
