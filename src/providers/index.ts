import type { QuestionProvider } from "../types.ts";
import { albums } from "./albums.ts";
import { capitals } from "./capitals.ts";
import { covers } from "./covers.ts";
import { flags } from "./flags.ts";
import { frenchCities } from "./france.ts";
import { justePrix } from "./juste-prix.ts";
import { music } from "./music.ts";
import { filmMusic, generiques, ost, seriesMusic } from "./ost.ts";
import { releaseYear } from "./release-year.ts";
import { filmImages, filmPosters, seriesImages, seriesPosters } from "./screen.ts";
import { screenshots } from "./screenshots.ts";
import { shapes } from "./shapes.ts";
import { summaries } from "./summaries.ts";
import { emojis, quotes } from "./texts.ts";
import { trivia } from "./trivia.ts";
import { art, dishes, landmarks, logos, people } from "./wiki.ts";
import { worldMap } from "./world-map.ts";

/** Tous les thèmes disponibles. Ajouter un thème = ajouter son module ici. */
export const providers: QuestionProvider[] = [
  trivia,
  summaries,
  justePrix,
  releaseYear,
  quotes,
  emojis,
  flags,
  capitals,
  shapes,
  worldMap,
  frenchCities,
  landmarks,
  dishes,
  art,
  people,
  logos,
  music,
  albums,
  generiques,
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
