import type { QuestionProvider } from "../types.ts";
import { capitals } from "./capitals.ts";
import { covers } from "./covers.ts";
import { flags } from "./flags.ts";
import { music } from "./music.ts";
import { filmMusic, ost, seriesMusic } from "./ost.ts";
import { filmImages, filmPosters, seriesImages, seriesPosters } from "./screen.ts";
import { screenshots } from "./screenshots.ts";
import { shapes } from "./shapes.ts";
import { trivia } from "./trivia.ts";

/** Tous les thèmes disponibles. Ajouter un thème = ajouter son module ici. */
export const providers: QuestionProvider[] = [
  trivia,
  flags,
  capitals,
  shapes,
  music,
  covers,
  screenshots,
  ost,
  filmPosters,
  filmImages,
  filmMusic,
  seriesPosters,
  seriesImages,
  seriesMusic,
];
