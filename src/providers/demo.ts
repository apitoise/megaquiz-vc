// Thème factice : sons générés localement, pour tester le double jugement (Titre / Artiste)
// en attendant le vrai thème musique (étape 3), qui le remplacera.
import { pickExcluding, randomInt } from "../game/random.ts";
import { PoolExhaustedError, type Question, type QuestionProvider } from "../types.ts";

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
