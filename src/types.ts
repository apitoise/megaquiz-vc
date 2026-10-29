export interface Media {
  type: "image" | "svg" | "audio" | "text";
  /** URL pour "image" et "audio" ; balisage SVG brut pour "svg" ; étiquette (catégorie) pour "text". */
  src: string;
  /** Offset de départ de l'extrait audio, en secondes. */
  startAt?: number;
}

export interface Answer {
  label: string; // « Réponse », « Titre », « Artiste »…
  value: string;
}

export interface Question {
  /** Identifiant stable (préfixé par le thème), pour l'historique et la blacklist. */
  id: string;
  theme: string;
  prompt: string;
  media: Media;
  /** Média affiché en plus à la révélation (ex. pochette d'album). */
  revealMedia?: Media;
  /** 1 entrée, ou 2 pour la musique (Titre, Artiste). */
  answers: Answer[];
}

export interface QuestionProvider {
  id: string;
  label: string;
  init(): Promise<void>;
  /** Renvoie une question dont l'id n'est pas dans `exclude`. Lève `PoolExhaustedError` si impossible. */
  next(exclude: Set<string>): Promise<Question>;
  /** Oublie le pool chargé : le prochain init() le reconstruit (ex. après la relecture des jaquettes). */
  invalidate?(): void;
}

export class PoolExhaustedError extends Error {
  constructor(themeId: string) {
    super(`Plus de question disponible pour le thème « ${themeId} »`);
    this.name = "PoolExhaustedError";
  }
}

/** Indice d'un joueur dans `Settings.players` (0 pour le premier). */
export type PlayerIndex = number;
/** Qui a trouvé une ligne de réponse : les indices des joueurs, triés (vide = personne). */
export type Judgment = readonly PlayerIndex[];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

export interface Settings {
  themes: string[];
  questionCount: number;
  timerSeconds: number;
  /** De MIN_PLAYERS à MAX_PLAYERS noms. */
  players: string[];
}
