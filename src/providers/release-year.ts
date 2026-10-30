import { coverUrl, type Game } from "../data/games.ts";
import { posterUrl, type ScreenWork } from "../data/screen.ts";
import { poolProvider, workSubject } from "./pool.ts";

/** Une œuvre datée, avec l'image (affiche ou jaquette, titre compris) qui l'illustre. */
interface DatedWork {
  kind: "film" | "series" | "game";
  key: string;
  name: string;
  year: number;
  image: string;
}

const PROMPTS: Record<DatedWork["kind"], (name: string) => string> = {
  film: (name) => `En quelle année est sorti le film « ${name} » ?`,
  series: (name) => `En quelle année a commencé la série « ${name} » ?`,
  game: (name) => `En quelle année est sorti le jeu « ${name} » ?`,
};

/** « Année de sortie » : chacun annonce une année, le plus proche marque (comme « Le juste prix »). */
export const releaseYear = poolProvider<DatedWork>({
  id: "release-year",
  label: "Année de sortie",
  async load() {
    const [films, series, games] = await Promise.all([
      import("../../data/films.json").then((m) => m.default as ScreenWork[]),
      import("../../data/series.json").then((m) => m.default as ScreenWork[]),
      import("../../data/games.json").then((m) => m.default as Game[]),
    ]);
    const screen = (kind: "film" | "series", works: ScreenWork[]): DatedWork[] =>
      works.flatMap((w) => (w.year && w.poster ? [{ kind, key: `${kind}-${w.id}`, name: w.name, year: w.year, image: posterUrl(w.poster) }] : []));
    return [
      ...screen("film", films),
      ...screen("series", series),
      ...games.flatMap((g): DatedWork[] => (g.year && g.cover ? [{ kind: "game", key: `game-${g.id}`, name: g.name, year: g.year, image: coverUrl(g.cover) }] : [])),
    ];
  },
  key: (w) => w.key,
  // Films, séries et jeux à parts égales, jamais deux fois de suite le même type.
  group: (w) => w.kind,
  subject: (w) => workSubject(w.kind, w.name),
  toQuestion: (w, id) => ({
    id,
    theme: "release-year",
    prompt: `${PROMPTS[w.kind](w.name)} Le plus proche gagne.`,
    media: { type: "image", src: w.image },
    answers: [{ label: "Année", value: String(w.year) }],
  }),
});
