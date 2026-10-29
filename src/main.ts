import "./style.css";
import { EFFECTS, volumeOf } from "./game/preferences.ts";
import { preloadQuestion } from "./game/preload.ts";
import { GameSession } from "./game/session.ts";
import { QuestionSource } from "./game/source.ts";
import { GameStorage, memoryStore, type KeyValueStore } from "./game/storage.ts";
import { covers, loadCoverManifest, loadCoverReviews, saveCoverReview } from "./providers/covers.ts";
import { providers } from "./providers/index.ts";
import { trivia, TRIVIA_EVERY } from "./providers/trivia.ts";
import { renderCoverReview } from "./ui/cover-review.ts";
import type { QuestionProvider, Settings } from "./types.ts";
import { h, toast } from "./ui/dom.ts";
import { loadResults, saveResult } from "./game/results-api.ts";
import type { GameResult } from "./game/results.ts";
import { computeScores } from "./game/scoring.ts";
import { renderEnd } from "./ui/end.ts";
import { mountGame } from "./ui/game.ts";
import { renderLeaderboard, standingsView } from "./ui/leaderboard.ts";
import { renderSetup } from "./ui/setup.ts";
import { setEffectsVolume } from "./ui/sound.ts";

const root = document.getElementById("app")!;
const storage = new GameStorage(browserStore());
const themeLabels = new Map(providers.map((p) => [p.id, p.label]));
const initialized = new Set<string>();
setEffectsVolume(volumeOf(storage.loadPreferences(), EFFECTS));

function browserStore(): KeyValueStore {
  try {
    localStorage.getItem("probe");
    return localStorage;
  } catch {
    return memoryStore();
  }
}

function showSetup(): void {
  renderSetup(root, providers, storage.loadSettings(), {
    start(settings) {
      storage.saveSettings(settings);
      void play(settings);
    },
    blacklistSize: storage.blacklist().size,
    historySize: storage.recentQuestionIds().size,
    clearBlacklist() {
      storage.clearBlacklist();
      toast("Questions retirées : liste remise à zéro.");
      showSetup();
    },
    clearHistory() {
      storage.clearHistory();
      toast("Historique des dernières parties effacé.");
      showSetup();
    },
    async showLeaderboard() {
      renderLeaderboard(root, await loadResults(), showSetup);
    },
    showCoverReview: () => void showCoverReview(),
    preferences: storage.loadPreferences(),
    savePreferences(preferences) {
      storage.savePreferences(preferences);
      setEffectsVolume(volumeOf(preferences, EFFECTS));
    },
  });
}

async function showCoverReview(): Promise<void> {
  const [manifest, reviews] = await Promise.all([loadCoverManifest(), loadCoverReviews()]);
  renderCoverReview(root, {
    manifest,
    reviews,
    async decide(imageId, decision) {
      try {
        return await saveCoverReview(imageId, decision);
      } catch {
        toast("Décision non enregistrée : serveur local injoignable.");
        return loadCoverReviews();
      }
    },
    back() {
      // Les décisions s'appliquent dès la prochaine partie.
      covers.invalidate?.();
      initialized.delete(covers.id);
      showSetup();
    },
  });
}

/** Enregistre la partie (si au moins une question a été jouée) puis affiche le classement. */
async function recordGame(session: GameSession, slot: HTMLElement): Promise<void> {
  if (!session.rounds.length) return slot.replaceChildren();
  const result: GameResult = {
    date: new Date().toISOString(),
    players: session.settings.players,
    scores: computeScores(session.rounds, session.settings.players.length),
    questions: session.rounds.length,
    themes: session.settings.themes,
    complete: !session.endedByUser,
  };
  const saved = await saveResult(result);
  if (!saved) {
    slot.replaceChildren(h("p", { class: "muted" }, "Résultat non enregistré : serveur local injoignable (lancez le jeu avec « npm run dev »)."));
    return;
  }
  slot.replaceChildren(standingsView(saved, saved.at(-1)));
}

/** Initialise les thèmes cochés ; un thème qui échoue est écarté sans bloquer la partie. */
async function readyProviders(ids: string[]): Promise<QuestionProvider[]> {
  const selected = providers.filter((p) => ids.includes(p.id));
  const results = await Promise.allSettled(
    selected.map(async (p) => {
      if (!initialized.has(p.id)) {
        await p.init();
        initialized.add(p.id);
      }
      return p;
    }),
  );
  return results.flatMap((r, i) => {
    if (r.status === "fulfilled") return [r.value];
    console.warn(`Thème ${selected[i].id} indisponible`, r.reason);
    const reason = r.reason instanceof Error ? ` : ${r.reason.message}` : "";
    toast(`Thème « ${selected[i].label} » ignoré${reason}.`);
    return [];
  });
}

/** Lance une partie ; une erreur imprévue ramène à la configuration au lieu de figer l'écran. */
async function play(settings: Settings): Promise<void> {
  try {
    await startGame(settings);
  } catch (err) {
    console.error("Partie interrompue", err);
    toast("Erreur inattendue : retour à la configuration.");
    showSetup();
  }
}

async function startGame(settings: Settings): Promise<void> {
  root.replaceChildren(h("p", { class: "loading" }, "Préparation des thèmes…"));
  const ready = await readyProviders(settings.themes);
  if (!ready.length) {
    toast("Aucun thème disponible.");
    return showSetup();
  }

  const preferences = storage.loadPreferences();
  const source = new QuestionSource({
    providers: ready,
    count: settings.questionCount,
    preload: (question) => preloadQuestion(question, volumeOf(preferences, question.theme)),
    recent: storage.recentQuestionIds(),
    blacklist: storage.blacklist(),
    onNotice: toast,
    // Si le thème est coché : une question de culture générale toutes les 5 questions.
    rhythm: { theme: trivia.id, every: TRIVIA_EVERY },
  });
  const session = new GameSession(settings, source, storage, { onNotice: toast });
  const unmount = mountGame(root, session, themeLabels, preferences.keyboard);
  const unsubscribe = session.subscribe(() => {
    if (session.phase !== "finished") return;
    unsubscribe();
    unmount();
    const slot = h("section", {}, h("p", { class: "muted" }, "Enregistrement de la partie…"));
    renderEnd(
      root,
      session.rounds,
      settings.players,
      themeLabels,
      { replay: () => void play(settings), setup: showSetup },
      slot,
      session.endedByUser,
    );
    void recordGame(session, slot);
  });
  await session.start();
}

showSetup();
