import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seededRng } from "../src/game/random.ts";
import { ADVANCE_DELAY_MS, audioStart, GameSession } from "../src/game/session.ts";
import { QuestionSource } from "../src/game/source.ts";
import { GameStorage, memoryStore } from "../src/game/storage.ts";
import type { QuestionProvider, Settings } from "../src/types.ts";
import { fakeProvider, okPreload } from "./helpers.ts";

const settings: Settings = { themes: [], questionCount: 3, timerSeconds: 20, players: ["Arthur", "Marie"] };

function setup(providers: QuestionProvider[], count = 3) {
  const storage = new GameStorage(memoryStore());
  const source = new QuestionSource({
    providers,
    count,
    preload: okPreload,
    recent: storage.recentQuestionIds(),
    blacklist: storage.blacklist(),
    rng: seededRng(1),
  });
  const session = new GameSession({ ...settings, questionCount: count }, source, storage, { now: () => Date.now() });
  return { session, storage };
}

/** Laisse les promesses en attente se résoudre. */
const flush = () => vi.advanceTimersByTimeAsync(0);

describe("GameSession", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it("enchaîne question → révélation → jugement → question suivante → fin", async () => {
    const { session } = setup([fakeProvider("a", 10)]);
    await session.start();
    expect(session.phase).toBe("question");
    expect(session.number).toBe(1);

    session.judge(0); // ignoré : pas encore révélé
    expect(session.phase).toBe("question");

    session.reveal();
    expect(session.phase).toBe("reveal");
    session.judge(0);
    expect(session.phase).toBe("advancing");
    expect(session.scores).toEqual([1, 0]);

    await vi.advanceTimersByTimeAsync(ADVANCE_DELAY_MS);
    expect(session.phase).toBe("question");
    expect(session.number).toBe(2);

    for (const j of [1, "none"] as const) {
      session.reveal();
      session.judge(j);
      await vi.advanceTimersByTimeAsync(ADVANCE_DELAY_MS);
    }
    expect(session.phase).toBe("finished");
    expect(session.scores).toEqual([1, 1]);
    expect(session.rounds).toHaveLength(3);
  });

  it("révèle automatiquement à la fin du timer", async () => {
    const { session } = setup([fakeProvider("a", 10)]);
    await session.start();
    await vi.advanceTimersByTimeAsync(19_900);
    expect(session.phase).toBe("question");
    await vi.advanceTimersByTimeAsync(200);
    expect(session.phase).toBe("reveal");
  });

  it("la pause gèle le timer", async () => {
    const { session } = setup([fakeProvider("a", 10)]);
    await session.start();
    await vi.advanceTimersByTimeAsync(10_000);
    session.togglePause();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(session.phase).toBe("question");
    session.reveal(); // bloqué pendant la pause
    expect(session.phase).toBe("question");
    session.togglePause();
    await vi.advanceTimersByTimeAsync(10_100);
    expect(session.phase).toBe("reveal");
  });

  it("question musicale : deux jugements, focus Titre puis Artiste", async () => {
    const { session } = setup([fakeProvider("music", 10, 2)]);
    await session.start();
    session.reveal();
    expect(session.focusRow).toBe(0);
    session.judge(0);
    expect(session.phase).toBe("reveal");
    expect(session.focusRow).toBe(1);
    session.judge(1);
    expect(session.phase).toBe("advancing");
    expect(session.rounds[0].judgments).toEqual([0, 1]);
  });

  it("question musicale : « les deux → Marie »", async () => {
    const { session } = setup([fakeProvider("music", 10, 2)]);
    await session.start();
    session.reveal();
    session.judgeAll(1);
    expect(session.phase).toBe("advancing");
    expect(session.scores).toEqual([0, 2]);
  });

  it("question musicale : un clic sur la ligne Artiste d'abord ramène le focus sur Titre", async () => {
    const { session } = setup([fakeProvider("music", 10, 2)]);
    await session.start();
    session.reveal();
    session.judge("none", 1);
    expect(session.focusRow).toBe(0);
    session.judge(0);
    expect(session.rounds[0].judgments).toEqual([0, "none"]);
  });

  it("question cassée : blacklistée, remplacée, et non comptée", async () => {
    const { session, storage } = setup([fakeProvider("a", 10)], 2);
    await session.start();
    const brokenId = session.current!.question.id;
    session.markBroken();
    await flush();
    expect(storage.blacklist().has(brokenId)).toBe(true);
    expect(session.phase).toBe("question");
    expect(session.number).toBe(1);
    expect(session.current!.question.id).not.toBe(brokenId);

    for (let i = 0; i < 2; i++) {
      session.reveal();
      session.judge(0);
      await vi.advanceTimersByTimeAsync(ADVANCE_DELAY_MS);
    }
    expect(session.phase).toBe("finished");
    expect(session.rounds).toHaveLength(2);
  });

  it("enregistre les questions posées dans l'historique", async () => {
    const { session, storage } = setup([fakeProvider("a", 10)], 1);
    await session.start();
    expect(storage.recentQuestionIds().has(session.current!.question.id)).toBe(true);
  });

  it("« Terminer » conserve les questions déjà jugées", async () => {
    const { session } = setup([fakeProvider("a", 10)], 5);
    await session.start();
    session.reveal();
    session.judge(1);
    await vi.advanceTimersByTimeAsync(ADVANCE_DELAY_MS);
    session.finish();
    expect(session.phase).toBe("finished");
    expect(session.rounds).toHaveLength(1);
    expect(session.total).toBe(1);
  });

  it("rejoue l'audio au bon offset et le garde pendant la révélation", async () => {
    const audio = { currentTime: 0, play: vi.fn(async () => {}), pause: vi.fn() };
    const storage = new GameStorage(memoryStore());
    const provider = fakeProvider("music", 5, 2);
    const source = new QuestionSource({
      providers: [provider],
      count: 1,
      preload: async (q) => ({ question: { ...q, media: { type: "audio", src: "x.mp3", startAt: 7 } }, audio }),
      recent: new Set(),
      blacklist: new Set(),
    });
    const session = new GameSession(settings, source, storage, { now: () => Date.now() });
    await session.start();
    expect(audio.currentTime).toBe(7);
    expect(audio.play).toHaveBeenCalledTimes(1);

    audio.currentTime = 15;
    session.reveal();
    expect(audio.pause).not.toHaveBeenCalled();
    session.replay();
    expect(audio.currentTime).toBe(7);

    session.judgeAll(0);
    await vi.advanceTimersByTimeAsync(ADVANCE_DELAY_MS);
    expect(audio.pause).toHaveBeenCalled();
  });

  it("remplace la question si l'audio tombe en panne pendant la lecture", async () => {
    const listeners: (() => void)[] = [];
    const audio = {
      currentTime: 0,
      duration: 30,
      play: vi.fn(async () => {}),
      pause: vi.fn(),
      addEventListener: (_type: "error", fn: () => void) => void listeners.push(fn),
    };
    const storage = new GameStorage(memoryStore());
    const source = new QuestionSource({
      providers: [fakeProvider("music", 5, 2)],
      count: 2,
      preload: async (q) => ({ question: { ...q, media: { type: "audio", src: "x.mp3", startAt: 3 } }, audio }),
      recent: new Set(),
      blacklist: new Set(),
    });
    const notices: string[] = [];
    const session = new GameSession(settings, source, storage, { now: () => Date.now(), onNotice: (m) => notices.push(m) });
    await session.start();
    const first = session.current!.question.id;
    listeners[0]();
    await flush();
    expect(session.current!.question.id).not.toBe(first);
    expect(session.number).toBe(1);
    expect(notices).toContain("Média indisponible : question remplacée.");
    expect(storage.blacklist().size).toBe(0);
  });
});

describe("audioStart", () => {
  it("garde l'offset prévu quand le timer tient dans l'extrait", () => {
    expect(audioStart(10, 30, 20)).toBe(10);
    expect(audioStart(4, 30, 20)).toBe(4);
  });

  it("avance le départ quand le timer est plus long", () => {
    expect(audioStart(10, 30, 25)).toBe(5);
    expect(audioStart(8, 30, 45)).toBe(0);
  });

  it("ignore une durée inconnue", () => {
    expect(audioStart(7, Number.NaN, 25)).toBe(7);
    expect(audioStart(7, undefined, 25)).toBe(7);
  });
});
