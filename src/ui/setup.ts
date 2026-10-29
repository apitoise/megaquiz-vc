import { AUDIO_THEMES, EFFECTS, type KeyboardLayout, type Preferences } from "../game/preferences.ts";
import { defaultPlayerName } from "../game/storage.ts";
import { MAX_PLAYERS, MIN_PLAYERS, type QuestionProvider, type Settings } from "../types.ts";
import { actionButton, h, toggleFullscreen } from "./dom.ts";
import { revealSound } from "./sound.ts";

export interface SetupOptions {
  start(settings: Settings): void;
  /** Questions marquées « cassées » et l'historique récent, gérables depuis la configuration. */
  blacklistSize: number;
  historySize: number;
  clearBlacklist(): void;
  clearHistory(): void;
  showLeaderboard(): void;
  showCoverReview(): void;
  /** Clavier et volumes : enregistrés dès qu'on les modifie. */
  preferences: Preferences;
  savePreferences(preferences: Preferences): void;
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
  // Joueurs : un champ par joueur ; les noms tapés sont conservés si on change le nombre de joueurs.
  const names = [...initial.players];
  const playerCount = h(
    "select",
    { name: "players" },
    ...Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => {
      const n = MIN_PLAYERS + i;
      return h("option", { value: n, selected: n === initial.players.length }, `${n} joueurs`);
    }),
  );
  const playerFields = h("div", { class: "player-fields" });
  const renderPlayers = () => {
    const count = Number(playerCount.value);
    while (names.length < count) names.push(defaultPlayerName(names.length));
    playerFields.replaceChildren(
      ...names.slice(0, count).map((name, i) => {
        const input = h("input", { type: "text", value: name, maxlength: 20, required: true, "aria-label": `Joueur ${i + 1}` });
        input.addEventListener("input", () => (names[i] = input.value));
        return h("label", { class: `player-field p${i}` }, h("kbd", {}, i + 1), input);
      }),
    );
  };
  playerCount.addEventListener("change", renderPlayers);
  renderPlayers();

  const preferencesDialog = renderPreferences(providers, options);

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
      h("label", {}, "Joueurs", playerCount),
    ),
    playerFields,
    error,
    h("button", { class: "action primary big", type: "submit" }, "Lancer la partie"),
    h(
      "div",
      { class: "setup-tools" },
      actionButton(null, "Classement", options.showLeaderboard, "small"),
      actionButton(null, "Réglages (clavier, volumes)", () => preferencesDialog.showModal(), "small"),
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
      players: names.slice(0, Number(playerCount.value)).map((name, i) => name.trim() || `Joueur ${i + 1}`),
    });
  });

  root.replaceChildren(form, preferencesDialog);
}

/** Fenêtre des réglages de l'appareil : disposition du clavier, volume des sons du jeu et des thèmes audio. */
function renderPreferences(providers: QuestionProvider[], options: SetupOptions): HTMLDialogElement {
  const preferences: Preferences = { keyboard: options.preferences.keyboard, volumes: { ...options.preferences.volumes } };
  const save = () => options.savePreferences({ keyboard: preferences.keyboard, volumes: { ...preferences.volumes } });

  const layoutChoice = (layout: KeyboardLayout, label: string) =>
    h(
      "label",
      { class: "theme-choice" },
      h("input", {
        type: "radio",
        name: "keyboard",
        value: layout,
        checked: preferences.keyboard === layout,
        onchange: () => {
          preferences.keyboard = layout;
          save();
        },
      }),
      h("span", {}, label),
    );

  const slider = (channel: string, label: string, preview?: () => void) => {
    const value = h("output", {}, `${preferences.volumes[channel] ?? 100} %`);
    const input = h("input", { type: "range", min: 0, max: 100, step: 5, value: preferences.volumes[channel] ?? 100 });
    input.addEventListener("input", () => {
      preferences.volumes[channel] = Number(input.value);
      value.textContent = `${input.value} %`;
      save();
    });
    if (preview) input.addEventListener("change", preview);
    return h("label", { class: "volume" }, h("span", {}, label), input, value);
  };

  const audioThemes = AUDIO_THEMES.flatMap((id) => providers.filter((p) => p.id === id));
  const dialog = h(
    "dialog",
    { class: "preferences" },
    h("h2", {}, "Réglages"),
    h("h3", {}, "Clavier"),
    h("div", { class: "layout-choice" }, layoutChoice("azerty", "AZERTY"), layoutChoice("qwerty", "QWERTY")),
    h("p", { class: "muted" }, "Les raccourcis ([N], [T], [P]…) suivent les lettres imprimées sur les touches, quelle que soit la langue du système."),
    h("h3", {}, "Volumes"),
    slider(EFFECTS, "Sons du jeu (tic-tac, points)", revealSound),
    ...audioThemes.map((p) => slider(p.id, p.label)),
  );
  dialog.append(actionButton(null, "Fermer", () => dialog.close(), "small"));
  return dialog;
}

function confirmThen(question: string, action: () => void): void {
  if (confirm(question)) action();
}

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
