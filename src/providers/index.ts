import type { QuestionProvider } from "../types.ts";
import { capitals } from "./capitals.ts";
import { demoSounds } from "./demo.ts";
import { flags } from "./flags.ts";
import { shapes } from "./shapes.ts";

/** Tous les thèmes disponibles. Ajouter un thème = ajouter son module ici. */
export const providers: QuestionProvider[] = [flags, capitals, shapes, demoSounds];
