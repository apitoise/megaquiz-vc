import type { Question } from "../types.ts";
import type { Prepared } from "./source.ts";

/** Au-delà, on considère le média comme indisponible et on remplace la question. */
const MEDIA_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Délai dépassé : ${what}`)), MEDIA_TIMEOUT_MS);
    promise.then(
      (value) => (clearTimeout(timer), resolve(value)),
      (err) => (clearTimeout(timer), reject(err)),
    );
  });
}

export function loadImage(src: string): Promise<void> {
  const img = new Image();
  img.src = src;
  return withTimeout(img.decode(), src);
}

function loadAudio(src: string, startAt: number): Promise<HTMLAudioElement> {
  const audio = new Audio();
  audio.preload = "auto";
  const ready = new Promise<HTMLAudioElement>((resolve, reject) => {
    audio.addEventListener("canplaythrough", () => resolve(audio), { once: true });
    audio.addEventListener("error", () => reject(new Error(`Audio illisible : ${src}`)), { once: true });
  });
  audio.src = src;
  audio.load();
  return withTimeout(ready, src).then((a) => {
    a.currentTime = startAt;
    return a;
  });
}

/** Charge le média d'une question avant de l'afficher ; rejette si le média est indisponible. */
export async function preloadQuestion(question: Question): Promise<Prepared> {
  const { media, revealMedia } = question;
  // Le média de révélation (pochette…) est accessoire : on le charge sans bloquer.
  if (revealMedia?.type === "image") loadImage(revealMedia.src).catch(() => {});
  switch (media.type) {
    case "image":
      await loadImage(media.src);
      return { question };
    case "audio":
      return { question, audio: await loadAudio(media.src, media.startAt ?? 0) };
    case "svg":
    case "text":
      return { question };
  }
}
