import { computeScores, outcome, type Round } from "../game/scoring.ts";
import type { Judgment } from "../types.ts";
import { actionButton, h } from "./dom.ts";

/** Écran de fin : score final, récapitulatif question par question, rejouer. */
export function renderEnd(
  root: HTMLElement,
  rounds: readonly Round[],
  players: [string, string],
  themeLabels: Map<string, string>,
  actions: { replay: () => void; setup: () => void },
  /** Emplacement du classement, rempli une fois la partie enregistrée. */
  leaderboard: HTMLElement,
  interrupted: boolean,
): void {
  const scores = computeScores(rounds);
  const result = outcome(scores);
  const headline = interrupted ? "Partie interrompue" : result.kind === "draw" ? "Égalité !" : `${players[result.player]} gagne !`;
  const who = (j: Judgment | null) => {
    if (j === null || j === "none") return h("span", { class: "who none" }, "—");
    if (j === "both") return h("span", { class: "who both" }, "Les deux");
    return h("span", { class: `who p${j}` }, players[j]);
  };

  const rows = rounds.map((round, i) =>
    h(
      "tr",
      {},
      h("td", { class: "num" }, i + 1),
      h("td", { class: "theme" }, themeLabels.get(round.question.theme) ?? round.question.theme),
      h(
        "td",
        {},
        ...round.question.answers.map((a, row) =>
          h(
            "div",
            { class: "recap-answer" },
            round.question.answers.length > 1 ? h("span", { class: "answer-label" }, `${a.label} : `) : null,
            h("span", {}, a.value),
            " ",
            who(round.judgments[row]),
          ),
        ),
      ),
    ),
  );

  root.replaceChildren(
    h(
      "div",
      { class: "end" },
      h("h1", {}, headline),
      h(
        "div",
        { class: "final-scores" },
        h("div", { class: "final p0" }, players[0], h("strong", {}, scores[0])),
        h("div", { class: "final p1" }, players[1], h("strong", {}, scores[1])),
      ),
      h("div", { class: "end-actions" }, actionButton(null, "Rejouer", actions.replay, "primary big"), actionButton(null, "Configuration", actions.setup, "big ghost")),
      leaderboard,
      h("h2", {}, "Récapitulatif"),
      rounds.length
        ? h("table", { class: "recap" }, h("thead", {}, h("tr", {}, h("th", {}, "#"), h("th", {}, "Thème"), h("th", {}, "Réponse et point"))), h("tbody", {}, ...rows))
        : h("p", {}, "Aucune question jouée."),
    ),
  );
}
