import type { QuestionProvider } from "../types.ts";
import { capitals } from "./capitals.ts";
import { covers } from "./covers.ts";
import { flags } from "./flags.ts";
import { music } from "./music.ts";
import { screenshots } from "./screenshots.ts";
import { shapes } from "./shapes.ts";

/** Tous les thèmes disponibles. Ajouter un thème = ajouter son module ici. */
export const providers: QuestionProvider[] = [flags, capitals, shapes, music, covers, screenshots];
