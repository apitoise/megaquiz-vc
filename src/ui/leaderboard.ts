import { biggestWin, computeStandings, marginLabel, scoreLine, winnerName, type GameResult } from "../game/results.ts";
import { actionButton, h } from "./dom.ts";

/** Parties affichées dans l'historique (les plus récentes). */
const HISTORY_ROWS = 15;

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** Classement (victoires, différence de points) et historique des parties. */
export function standingsView(results: readonly GameResult[], latest?: GameResult): HTMLElement {
  const complete = results.filter((r) => r.complete);
  if (!results.length) return h("p", { class: "muted" }, "Aucune partie enregistrée pour l'instant.");

  const standings = computeStandings(results);
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  const table = h(
    "table",
    { class: "standings" },
    h(
      "thead",
      {},
      h(
        "tr",
        {},
        h("th", {}, "#"),
        h("th", {}, "Joueur"),
        h("th", { title: "Parties jouées" }, "J"),
        h("th", { title: "Victoires" }, "V"),
        h("th", { title: "Nuls" }, "N"),
        h("th", { title: "Défaites" }, "D"),
        h("th", { title: "Points marqués – points du meilleur adversaire" }, "Points"),
        h("th", { title: "Différence de points cumulée" }, "Diff."),
      ),
    ),
    h(
      "tbody",
      {},
      ...standings.map((s, i) =>
        h(
          "tr",
          {},
          h("td", { class: "num" }, i + 1),
          h("td", { class: "name" }, s.name),
          h("td", {}, s.played),
          h("td", { class: "wins" }, s.wins),
          h("td", {}, s.draws),
          h("td", {}, s.losses),
          h("td", {}, `${s.pointsFor} – ${s.pointsAgainst}`),
          h("td", { class: s.diff > 0 ? "pos" : s.diff < 0 ? "neg" : "" }, signed(s.diff)),
        ),
      ),
    ),
  );

  const record = biggestWin(results);
  const recordLine = record
    ? h(
        "p",
        { class: "muted" },
        `Plus large victoire : ${winnerName(record)} (${scoreLine(record)}, ${marginLabel(record.scores)}) le ${dateFormat.format(new Date(record.date))}`,
      )
    : null;

  const history = h(
    "table",
    { class: "history" },
    h("thead", {}, h("tr", {}, h("th", {}, "Date"), h("th", {}, "Score"), h("th", {}, "Écart"), h("th", {}, "Questions"))),
    h(
      "tbody",
      {},
      ...[...results]
        .reverse()
        .slice(0, HISTORY_ROWS)
        .map((r) =>
          h(
            "tr",
            { class: `${r.complete ? "" : "interrupted"} ${r === latest ? "latest" : ""}` },
            h("td", {}, dateFormat.format(new Date(r.date))),
            h("td", {}, scoreLine(r)),
            h("td", {}, marginLabel(r.scores)),
            h("td", {}, r.complete ? r.questions : `${r.questions} (interrompue)`),
          ),
        ),
    ),
  );

  return h(
    "div",
    { class: "leaderboard" },
    h("h2", {}, `Classement (${complete.length} partie${complete.length > 1 ? "s" : ""})`),
    complete.length ? table : h("p", { class: "muted" }, "Aucune partie complète pour l'instant."),
    recordLine,
    h("h2", {}, "Dernières parties"),
    history,
    results.length > complete.length ? h("p", { class: "muted" }, "Les parties interrompues (« Terminer ») ne comptent pas au classement.") : null,
  );
}

/** Écran « Classement » accessible depuis la configuration. */
export function renderLeaderboard(root: HTMLElement, results: readonly GameResult[], back: () => void): void {
  root.replaceChildren(
    h("div", { class: "end" }, h("h1", {}, "Classement"), standingsView(results), h("div", { class: "end-actions" }, actionButton(null, "Retour", back, "primary big"))),
  );
}
