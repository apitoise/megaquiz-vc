import "./style.css";
import { preloadQuestion } from "./game/preload.ts";
import { GameSession } from "./game/session.ts";
import { QuestionSource } from "./game/source.ts";
import { GameStorage, memoryStore, type KeyValueStore } from "./game/storage.ts";
import { providers } from "./providers/index.ts";
import type { QuestionProvider, Settings } from "./types.ts";
import { h, toast } from "./ui/dom.ts";
import { renderEnd } from "./ui/end.ts";
import { mountGame } from "./ui/game.ts";
import { renderSetup } from "./ui/setup.ts";

const root = document.getElementById("app")!;
const storage = new GameStorage(browserStore());
const themeLabels = new Map(providers.map((p) => [p.id, p.label]));
const initialized = new Set<string>();

function browserStore(): KeyValueStore {
  try {
    localStorage.getItem("probe");
    return localStorage;
  } catch {
    return memoryStore();
  }
}

function showSetup(): void {
  renderSetup(root, providers, storage.loadSettings(), (settings) => {
    storage.saveSettings(settings);
    void play(settings);
  });
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
    toast(`Thème « ${selected[i].label} » indisponible, il est ignoré.`);
    return [];
  });
}

async function play(settings: Settings): Promise<void> {
  root.replaceChildren(h("p", { class: "loading" }, "Préparation des thèmes…"));
  const ready = await readyProviders(settings.themes);
  if (!ready.length) {
    toast("Aucun thème disponible.");
    return showSetup();
  }

  const source = new QuestionSource({
    providers: ready,
    count: settings.questionCount,
    preload: preloadQuestion,
    recent: storage.recentQuestionIds(),
    blacklist: storage.blacklist(),
    onNotice: toast,
  });
  const session = new GameSession(settings, source, storage, { onNotice: toast });
  const unmount = mountGame(root, session, themeLabels);
  const unsubscribe = session.subscribe(() => {
    if (session.phase !== "finished") return;
    unsubscribe();
    unmount();
    renderEnd(root, session.rounds, settings.players, themeLabels, {
      replay: () => void play(settings),
      setup: showSetup,
    });
  });
  await session.start();
}

showSetup();
