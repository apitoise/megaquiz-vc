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

export type PlayerIndex = 0 | 1;
/** Qui a marqué sur une ligne de réponse : un joueur, les deux (réponse trouvée en même temps), ou personne. */
export type Judgment = PlayerIndex | "both" | "none";

export interface Settings {
  themes: string[];
  questionCount: number;
  timerSeconds: number;
  players: [string, string];
}
