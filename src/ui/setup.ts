import type { QuestionProvider, Settings } from "../types.ts";
import { actionButton, h, toggleFullscreen } from "./dom.ts";

export interface SetupOptions {
  start(settings: Settings): void;
  /** Questions marquées « cassées » et l'historique récent, gérables depuis la configuration. */
  blacklistSize: number;
  historySize: number;
  clearBlacklist(): void;
  clearHistory(): void;
  showLeaderboard(): void;
  showCoverReview(): void;
}

/** Écran de configuration. Appelle `options.start` avec les réglages validés. */
export function renderSetup(root: HTMLElement, providers: QuestionProvider[], initial: Settings, options: SetupOptions): void {
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
  const setAll = (value: boolean) => themeBoxes.forEach((label) => (label.querySelector("input")!.checked = value));
  const count = h("input", { type: "number", name: "count", min: 1, max: 500, value: initial.questionCount, required: true });
  const timer = h("input", { type: "number", name: "timer", min: 3, max: 120, value: initial.timerSeconds, required: true });
  const p1 = h("input", { type: "text", name: "p1", value: initial.players[0], maxlength: 20, required: true });
  const p2 = h("input", { type: "text", name: "p2", value: initial.players[1], maxlength: 20, required: true });

  const form = h(
    "form",
    { class: "setup" },
    h("h1", {}, "MégaQuiz"),
    h(
      "fieldset",
      {},
      h(
        "legend",
        {},
        "Thèmes ",
        actionButton(null, "Tout cocher", () => setAll(true), "small ghost"),
        actionButton(null, "Tout décocher", () => setAll(false), "small ghost"),
      ),
      h("div", { class: "theme-grid" }, ...themeBoxes),
    ),
    h(
      "div",
      { class: "setup-row" },
      h("label", {}, "Questions", count),
      h("label", {}, "Timer (s)", timer),
      h("label", {}, "Joueur [A]", p1),
      h("label", {}, "Joueur [M]", p2),
    ),
    error,
    h("button", { class: "action primary big", type: "submit" }, "Lancer la partie"),
    h(
      "div",
      { class: "setup-tools" },
      actionButton(null, "Classement", options.showLeaderboard, "small"),
      actionButton(null, "Relire les jaquettes", options.showCoverReview, "small ghost"),
      actionButton(null, "Plein écran", toggleFullscreen, "small ghost"),
      h(
        "span",
        {},
        `${options.blacklistSize} question(s) retirée(s)`,
        options.blacklistSize ? actionButton(null, "Réinitialiser", () => confirmThen("Remettre en jeu les questions retirées ?", options.clearBlacklist), "small ghost") : null,
      ),
      h(
        "span",
        {},
        `${options.historySize} question(s) évitée(s) (3 dernières parties)`,
        options.historySize ? actionButton(null, "Oublier", () => confirmThen("Oublier l'historique des dernières parties ?", options.clearHistory), "small ghost") : null,
      ),
    ),
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
    options.start({
      themes,
      questionCount: clampInt(count.value, 1, 500, 50),
      timerSeconds: clampInt(timer.value, 3, 120, 20),
      players: [p1.value.trim() || "Joueur 1", p2.value.trim() || "Joueur 2"],
    });
  });

  root.replaceChildren(form);
}

function confirmThen(question: string, action: () => void): void {
  if (confirm(question)) action();
}

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
