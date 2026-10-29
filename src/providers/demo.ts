// Thèmes factices de l'étape 1, pour valider la boucle de jeu sans réseau.
// À retirer (ou à masquer) une fois les vrais thèmes en place.
import { pickExcluding, randomInt } from "../game/random.ts";
import { PoolExhaustedError, type Question, type QuestionProvider } from "../types.ts";

const COLORS: [string, string][] = [
  ["Rouge", "#e53935"],
  ["Vert", "#43a047"],
  ["Bleu", "#1e88e5"],
  ["Jaune", "#fdd835"],
  ["Orange", "#fb8c00"],
  ["Violet", "#8e24aa"],
  ["Rose", "#ec407a"],
  ["Marron", "#6d4c41"],
  ["Gris", "#9e9e9e"],
  ["Turquoise", "#26c6da"],
  ["Noir", "#111111"],
  ["Blanc", "#fafafa"],
];

/** Couleurs : média "image" (data URI). Une entrée volontairement cassée teste le remplacement automatique. */
export const demoColors: QuestionProvider = {
  id: "demo-colors",
  label: "Démo : couleurs",
  async init() {},
  async next(exclude) {
    const pool: ColorItem[] = [...COLORS.map(([name, hex]) => ({ id: `demo-colors:${name}`, name, hex })), BROKEN_COLOR];
    const item = pickExcluding(pool, (c) => c.id, exclude);
    if (!item) throw new PoolExhaustedError(this.id);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3" width="640" height="480"><rect width="4" height="3" fill="${item.hex}"/></svg>`;
    return {
      id: item.id,
      theme: this.id,
      prompt: "Quelle est cette couleur ?",
      media: { type: "image", src: item.src ?? `data:image/svg+xml,${encodeURIComponent(svg)}` },
      answers: [{ label: "Réponse", value: item.name }],
    };
  },
};

type ColorItem = { id: string; name: string; hex: string; src?: string };
const BROKEN_COLOR: ColorItem = { id: "demo-colors:cassee", name: "Cassée", hex: "", src: "data:image/png;base64,AAAA" };

const SHAPES: [string, string][] = [
  ["Cercle", `<circle cx="50" cy="50" r="40"/>`],
  ["Carré", `<rect x="12" y="12" width="76" height="76"/>`],
  ["Triangle", `<polygon points="50,8 92,88 8,88"/>`],
  ["Losange", `<polygon points="50,6 90,50 50,94 10,50"/>`],
  ["Étoile", `<polygon points="50,5 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38"/>`],
  ["Hexagone", `<polygon points="27,10 73,10 96,50 73,90 27,90 4,50"/>`],
  ["Croix", `<polygon points="35,5 65,5 65,35 95,35 95,65 65,65 65,95 35,95 35,65 5,65 5,35 35,35"/>`],
  ["Cœur", `<path d="M50 88 L14 52 A20 20 0 0 1 50 22 A20 20 0 0 1 86 52 Z"/>`],
];

/** Formes : média "svg" inline, comme les futures silhouettes de pays. */
export const demoShapes: QuestionProvider = {
  id: "demo-shapes",
  label: "Démo : formes",
  async init() {},
  async next(exclude) {
    const item = pickExcluding(SHAPES, ([name]) => `demo-shapes:${name}`, exclude);
    if (!item) throw new PoolExhaustedError(this.id);
    const [name, body] = item;
    return {
      id: `demo-shapes:${name}`,
      theme: this.id,
      prompt: "Quelle est cette forme ?",
      media: { type: "svg", src: `<svg viewBox="0 0 100 100" fill="currentColor">${body}</svg>` },
      answers: [{ label: "Réponse", value: name }],
    };
  },
};

const NOTES: [string, number][] = [
  ["Do", 261.63],
  ["Ré", 293.66],
  ["Mi", 329.63],
  ["Fa", 349.23],
  ["Sol", 392.0],
  ["La", 440.0],
  ["Si", 493.88],
];
const WAVES = ["Sinus", "Carré"] as const;

/** Sons : média "audio" de 30 s généré localement, avec deux jugements (Titre / Artiste) comme la musique. */
export const demoSounds: QuestionProvider = {
  id: "demo-sounds",
  label: "Démo : sons (double jugement)",
  async init() {},
  async next(exclude): Promise<Question> {
    const pool = NOTES.flatMap(([note, freq]) => WAVES.map((wave) => ({ id: `demo-sounds:${note}-${wave}`, note, freq, wave })));
    const item = pickExcluding(pool, (s) => s.id, exclude);
    if (!item) throw new PoolExhaustedError(this.id);
    const blob = toneWav(item.freq, item.wave, 30);
    return {
      id: item.id,
      theme: this.id,
      prompt: "Quelle est cette note, et quel est ce timbre ?",
      media: { type: "audio", src: URL.createObjectURL(blob), startAt: randomInt(11) },
      answers: [
        { label: "Titre", value: item.note },
        { label: "Artiste", value: item.wave },
      ],
    };
  },
};

/** WAV PCM 8 bits mono, 8 kHz : une note avec un léger battement pour qu'on entende le temps passer. */
function toneWav(freq: number, wave: (typeof WAVES)[number], seconds: number): Blob {
  const rate = 8000;
  const n = rate * seconds;
  const buf = new DataView(new ArrayBuffer(44 + n));
  const str = (o: number, s: string) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  buf.setUint32(4, 36 + n, true);
  str(8, "WAVEfmt ");
  buf.setUint32(16, 16, true);
  buf.setUint16(20, 1, true);
  buf.setUint16(22, 1, true);
  buf.setUint32(24, rate, true);
  buf.setUint32(28, rate, true);
  buf.setUint16(32, 1, true);
  buf.setUint16(34, 8, true);
  str(36, "data");
  buf.setUint32(40, n, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const phase = Math.sin(2 * Math.PI * freq * t);
    const v = wave === "Sinus" ? phase : Math.sign(phase) * 0.6;
    const envelope = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.5 * t);
    buf.setUint8(44 + i, 128 + Math.round(v * envelope * 90));
  }
  return new Blob([buf], { type: "audio/wav" });
}
