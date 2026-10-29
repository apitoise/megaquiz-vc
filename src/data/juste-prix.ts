/** Question du « Juste prix » (data/juste_prix.json) : le plus proche de la réponse gagne. */
export interface PriceQuestion {
  id: string;
  /** « prix », « chiffres » ou « habitants » : tirés à parts égales. */
  category: string;
  question: string;
  answer: string;
  /** Illustration (Wikipédia), ou null : la question s'affiche alors en grand. */
  image: string | null;
}
