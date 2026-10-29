import type { QuestionProvider } from "../types.ts";
import { demoColors, demoShapes, demoSounds } from "./demo.ts";

/** Tous les thèmes disponibles. Ajouter un thème = ajouter son module ici. */
export const providers: QuestionProvider[] = [demoColors, demoShapes, demoSounds];
