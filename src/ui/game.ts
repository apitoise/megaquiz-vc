import { keyToAction, type Action } from "../game/keys.ts";
import type { GameSession } from "../game/session.ts";
import type { Judgment, Media, Question } from "../types.ts";
import { actionButton, h } from "./dom.ts";

/** Affiche la partie et branche clavier + souris. Renvoie une fonction de nettoyage. */
export function mountGame(root: HTMLElement, session: GameSession, themeLabels: Map<string, string>): () => void {
  const [nameA, nameM] = session.settings.players;
  const timerFill = h("div", { class: "timer-fill" });
  const screen = h("div", { class: "game" });
  root.replaceChildren(screen);

  // Le nœud média est conservé d'un rendu à l'autre pour éviter tout clignotement.
  let mediaFor: Question | null = null;
  let mediaNode: HTMLElement = h("div");

  const dispatch = (action: Action) => {
    switch (action.type) {
      case "reveal":
        return session.reveal();
      case "judge":
        return session.judge(action.judgment);
      case "judgeAll":
        return session.judgeAll(action.judgment);
      case "pause":
        return session.togglePause();
      case "broken":
        return session.markBroken();
      case "replay":
        return session.replay();
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const action = keyToAction(e.key, e.shiftKey);
    if (!action) return;
    e.preventDefault();
    dispatch(action);
  };
  window.addEventListener("keydown", onKey);

  function render(): void {
    const { phase, round, current } = session;
    const question = current?.question ?? null;
    const [scoreA, scoreM] = session.scores;
    const revealed = phase === "reveal" || phase === "advancing";

    if (question && question !== mediaFor) {
      mediaFor = question;
      mediaNode = renderMedia(question.media, () => session.mediaFailed());
    }

    const hud = h(
      "header",
      { class: "hud" },
      h("span", { class: "hud-theme" }, question ? (themeLabels.get(question.theme) ?? question.theme) : ""),
      h("span", { class: "hud-count" }, `${Math.max(1, session.number)} / ${session.total}`),
      h("span", { class: "hud-score p0" }, nameA, h("strong", {}, scoreA)),
      h("span", { class: "hud-score p1" }, nameM, h("strong", {}, scoreM)),
      h(
        "span",
        { class: "hud-tools" },
        actionButton("P", session.paused ? "Reprendre" : "Pause", () => session.togglePause(), "small"),
        actionButton(null, "Terminer", () => {
          if (confirm("Terminer la partie maintenant ?")) session.finish();
        }, "small ghost"),
      ),
    );

    const multi = (question?.answers.length ?? 0) > 1;
    const stage = h("main", { class: `stage ${revealed ? "revealed" : ""} ${multi ? "multi" : ""}` });
    if (phase === "loading" || !question || !round) {
      stage.append(h("p", { class: "loading" }, "Chargement de la question…"));
    } else {
      stage.append(h("p", { class: "prompt" }, question.prompt));
      const mediaRow = h("div", { class: "media-row" }, mediaNode);
      if (revealed && question.revealMedia?.type === "image") {
        mediaRow.append(h("img", { class: "reveal-media", src: question.revealMedia.src, alt: "" }));
      }
      stage.append(mediaRow);
      if (revealed) stage.append(renderJudging(question, round.judgments, session.focusRow, phase === "reveal"));
    }

    const controls = h("footer", { class: "controls" });
    if (phase === "question") controls.append(actionButton("Espace", "Révéler", () => session.reveal(), "primary"));
    if (phase === "reveal" && question && question.answers.length > 1) {
      controls.append(
        actionButton("⇧A", `Les deux → ${nameA}`, () => session.judgeAll(0), "p0"),
        actionButton("⇧M", `Les deux → ${nameM}`, () => session.judgeAll(1), "p1"),
      );
    }
    if ((phase === "question" || phase === "reveal") && question) {
      if (question.media.type === "audio") controls.append(actionButton("R", "Rejouer", () => session.replay()));
      controls.append(actionButton("X", "Question cassée", () => session.markBroken(), "ghost"));
    }

    screen.replaceChildren(hud, h("div", { class: "timer" }, timerFill), stage, controls);
    if (session.paused) {
      screen.append(
        h(
          "div",
          { class: "overlay" },
          h("p", {}, "Pause"),
          actionButton("P", "Reprendre", () => session.togglePause(), "primary big"),
        ),
      );
    }
  }

  function renderJudging(question: Question, judgments: (Judgment | null)[], focusRow: number, active: boolean): HTMLElement {
    const multi = question.answers.length > 1;
    const rows = question.answers.map((answer, row) => {
      const judged = judgments[row];
      const choice = (key: string, label: string, judgment: Judgment, cls: string) =>
        actionButton(key, label, () => session.judge(judgment, row), `${cls} ${judged === judgment ? "selected" : ""}`);
      return h(
        "div",
        { class: `judge-row ${active && multi && row === focusRow && judged === null ? "focus" : ""}` },
        h("div", { class: "answer" }, multi ? h("span", { class: "answer-label" }, answer.label) : null, h("span", { class: "answer-value" }, answer.value)),
        h(
          "div",
          { class: "judge-buttons" },
          choice("A", nameA, 0, "p0"),
          choice("M", nameM, 1, "p1"),
          choice("N", "Aucun", "none", "ghost"),
        ),
      );
    });
    return h("section", { class: "judging" }, ...rows);
  }

  // Barre de timer animée indépendamment des rendus.
  let frame = requestAnimationFrame(function tick() {
    timerFill.style.transform = `scaleX(${session.timeFraction()})`;
    frame = requestAnimationFrame(tick);
  });

  const unsubscribe = session.subscribe(render);
  render();

  return () => {
    unsubscribe();
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", onKey);
  };
}

function renderMedia(media: Media, onError: () => void): HTMLElement {
  switch (media.type) {
    case "image": {
      const img = h("img", { class: "media", src: media.src, alt: "" });
      img.addEventListener("error", onError, { once: true });
      return img;
    }
    case "svg": {
      const box = h("div", { class: "media media-svg" });
      box.innerHTML = media.src; // SVG généré localement par le thème
      return box;
    }
    case "audio":
      return h("div", { class: "media media-audio", "aria-label": "Extrait audio" }, h("span", {}), h("span", {}), h("span", {}), h("span", {}), h("span", {}));
  }
}
