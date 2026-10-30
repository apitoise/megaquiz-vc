import { keycap, keyToAction, type Action } from "../game/keys.ts";
import type { KeyboardLayout } from "../game/preferences.ts";
import type { GameSession } from "../game/session.ts";
import type { Judgment, Media, Question } from "../types.ts";
import { actionButton, h, toggleFullscreen } from "./dom.ts";
import { judgmentSound, revealSound, soundEnabled, tick, toggleSound } from "./sound.ts";

/** Affiche la partie et branche clavier + souris. Renvoie une fonction de nettoyage. */
export function mountGame(root: HTMLElement, session: GameSession, themeLabels: Map<string, string>, layout: KeyboardLayout): () => void {
  const { players } = session.settings;
  const timerFill = h("div", { class: "timer-fill" });
  // Au-delà de 4 joueurs, scores et boutons de jugement plus compacts (tout doit tenir à l'écran).
  const screen = h("div", { class: `game ${players.length > 4 ? "many-players" : ""}` });
  root.replaceChildren(screen);

  // Le nœud média est conservé d'un rendu à l'autre pour éviter tout clignotement.
  let mediaFor: Question | null = null;
  let mediaNode: HTMLElement = h("div");

  const dispatch = (action: Action) => {
    switch (action.type) {
      case "confirm":
        if (session.phase === "question") return session.reveal();
        return action.all ? session.validateAll() : session.validate();
      case "toggle":
        return session.toggle(action.player);
      case "nobody":
        return session.judge([]);
      case "everyone":
        return session.judge(session.everyone());
      case "pause":
        return session.togglePause();
      case "broken":
        return session.markBroken();
      case "replay":
        return session.replay();
      case "fullscreen":
        return toggleFullscreen();
      case "sound":
        toggleSound();
        return render();
    }
  };

  // Sons : révélation et jugements détectés à chaque rendu (quel que soit le déclencheur : clavier,
  // souris, fin du timer), tic-tac cadencé par la boucle d'animation du timer.
  let lastPhase = session.phase;
  let lastRound = session.round;
  let lastSecond: number | null = null;
  function playStateSounds(): void {
    const { phase, round } = session;
    if (phase === "reveal" && lastPhase === "question") revealSound();
    if (round && lastRound && round !== lastRound && round.question === lastRound.question) {
      const changed = round.judgments.findIndex((j, i) => j !== null && j !== lastRound!.judgments[i]);
      if (changed >= 0) judgmentSound(round.judgments[changed]!);
    }
    if (round?.question !== lastRound?.question) lastSecond = null;
    lastPhase = phase;
    lastRound = round;
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const action = keyToAction(keycap(e, layout), e.shiftKey);
    if (!action) return;
    e.preventDefault();
    dispatch(action);
  };
  window.addEventListener("keydown", onKey);

  function render(): void {
    playStateSounds();
    const { phase, round, current } = session;
    const question = current?.question ?? null;
    const scores = session.scores;
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
      h("span", { class: "hud-scores" }, ...players.map((name, i) => h("span", { class: `hud-score p${i}` }, name, h("strong", {}, scores[i])))),
      h(
        "span",
        { class: "hud-tools" },
        actionButton("P", session.paused ? "Reprendre" : "Pause", () => session.togglePause(), "small"),
        actionButton("S", soundEnabled() ? "Son" : "Son coupé", () => dispatch({ type: "sound" }), `small ${soundEnabled() ? "" : "ghost"}`),
        actionButton("F", "Plein écran", toggleFullscreen, "small ghost"),
        actionButton(null, "Terminer", () => {
          if (confirm("Terminer la partie maintenant ? Elle ne comptera pas au classement.")) session.finish(true);
        }, "small ghost"),
      ),
    );

    const multi = (question?.answers.length ?? 0) > 1;
    const textQuestion = question?.media.type === "text";
    const longText = textQuestion && (question?.prompt.length ?? 0) > 110;
    const stage = h("main", {
      class: `stage ${revealed ? "revealed" : ""} ${multi ? "multi" : ""} ${textQuestion ? "text-question" : ""} ${longText ? "long-text" : ""}`,
    });
    if (phase === "loading" || !question || !round) {
      stage.append(
        session.waiting
          ? h("p", { class: "loading waiting" }, "Connexion perdue : nouvel essai automatique…", h("small", {}, "La partie reprendra dès que le réseau revient. [Terminer] reste disponible."))
          : // Le second message n'apparaît (en CSS) que si le chargement traîne.
            h("p", { class: "loading" }, "Chargement de la question…", h("small", { class: "slow" }, "Ça prend du temps… réseau lent ?")),
      );
    } else {
      stage.append(h("p", { class: "prompt" }, question.prompt));
      const mediaRow = h("div", { class: "media-row" }, mediaNode);
      if (revealed && question.revealMedia?.type === "image") {
        mediaRow.append(h("img", { class: "reveal-media", src: question.revealMedia.src, alt: "" }));
      }
      stage.append(mediaRow);
      if (revealed) stage.append(renderJudging(question, round.judgments, phase === "reveal"));
    }

    const controls = h("footer", { class: "controls" });
    if (phase === "question") controls.append(actionButton("Espace", "Révéler", () => session.reveal(), "primary"));
    if (phase === "reveal" && question && question.answers.length > 1) {
      controls.append(actionButton("⇧Espace", "Valider pour toutes les lignes", () => session.validateAll()));
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

  /**
   * Une ligne par réponse : on coche les joueurs qui ont trouvé (touches 1 à 8), puis on valide
   * (Espace). « Personne » et « Tout le monde » valident directement.
   */
  function renderJudging(question: Question, judgments: (Judgment | null)[], active: boolean): HTMLElement {
    const multi = question.answers.length > 1;
    const rows = question.answers.map((answer, row) => {
      const focused = active && row === session.focusRow;
      const shown = focused ? session.selection : (judgments[row] ?? []);
      const player = (name: string, i: number) =>
        actionButton(String(i + 1), name, () => session.toggle(i, row), `player p${i} ${shown.includes(i) ? "selected" : ""}`);
      return h(
        "div",
        { class: `judge-row ${focused && multi ? "focus" : ""} ${judgments[row] !== null && !focused ? "judged" : ""}` },
        h("div", { class: "answer" }, multi ? h("span", { class: "answer-label" }, answer.label) : null, h("span", { class: "answer-value" }, answer.value)),
        h(
          "div",
          { class: "judge-buttons" },
          ...players.map(player),
          actionButton("T", "Tout le monde", () => session.judge(session.everyone(), row), "ghost"),
          actionButton("N", "Personne", () => session.judge([], row), "ghost"),
          focused ? actionButton("Espace", shown.length ? "Valider" : "Valider (personne)", () => session.validate(), "primary") : null,
        ),
      );
    });
    return h("section", { class: "judging" }, ...rows);
  }

  // Barre de timer animée indépendamment des rendus.
  let frame = requestAnimationFrame(function animate() {
    const fraction = session.timeFraction();
    timerFill.style.transform = `scaleX(${fraction})`;
    // Tic-tac une fois par seconde, sauf sur les questions audio (il couvrirait l'extrait).
    const question = session.current?.question;
    if (session.phase === "question" && !session.paused && question && question.media.type !== "audio") {
      const secondsLeft = Math.ceil(fraction * session.settings.timerSeconds);
      if (lastSecond !== null && secondsLeft !== lastSecond && secondsLeft > 0) tick(secondsLeft <= 5);
      lastSecond = secondsLeft;
    }
    frame = requestAnimationFrame(animate);
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
      const img = h("img", { class: ["media", media.blur && "blurred", media.light && "light"].filter(Boolean).join(" "), src: media.src, alt: "" });
      img.addEventListener("error", onError, { once: true });
      return img;
    }
    case "svg": {
      const box = h("div", { class: media.wide ? "media media-svg wide" : "media media-svg" });
      box.innerHTML = media.src; // SVG généré localement par le thème
      return box;
    }
    case "audio":
      return h("div", { class: "media media-audio", "aria-label": "Extrait audio" }, h("span", {}), h("span", {}), h("span", {}), h("span", {}), h("span", {}));
    case "text":
      // Question sans image : une carte avec sa catégorie ; la question elle-même est l'énoncé.
      return h("div", { class: "media media-text" }, media.src);
  }
}
