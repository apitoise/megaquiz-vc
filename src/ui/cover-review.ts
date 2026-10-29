import { anonymizedCoverUrl, type CoverDecision, type CoverManifest, type CoverReviews } from "../data/covers.ts";
import { coverUrl } from "../data/games.ts";
import { actionButton, h } from "./dom.ts";

type Filter = "a-verifier" | "sure" | "rejete" | "toutes";

const FLAG_LABELS: Record<string, string> = {
  "titre-non-detecte": "titre non repéré",
  "titre-residuel": "titre encore lisible",
  "masque-large": "grande zone effacée",
};

export interface CoverReviewOptions {
  manifest: CoverManifest | null;
  reviews: CoverReviews;
  /** Enregistre une décision (null = l'annuler) ; renvoie toutes les décisions. */
  decide(imageId: string, decision: CoverDecision | null): Promise<CoverReviews>;
  back(): void;
}

/** Écran de relecture : jaquette d'origine et version anonymisée côte à côte, à valider ou rejeter. */
export function renderCoverReview(root: HTMLElement, options: CoverReviewOptions): void {
  const { manifest } = options;
  let reviews = options.reviews;
  let filter: Filter = "a-verifier";
  const screen = h("div", { class: "review" });
  root.replaceChildren(screen);

  if (!manifest) {
    screen.append(
      h("h1", {}, "Relecture des jaquettes"),
      h("p", {}, "Aucune jaquette anonymisée pour l'instant. Lancez d'abord : npm run covers:anonymize"),
      actionButton(null, "Retour", options.back, "primary big"),
    );
    return;
  }

  const entries = Object.entries(manifest).sort(([, a], [, b]) => a.game.localeCompare(b.game, "fr"));
  const matches = (imageId: string, status: string) => {
    if (filter === "toutes") return true;
    if (filter === "rejete") return reviews[imageId] === "rejete";
    return status === filter && reviews[imageId] !== "rejete";
  };

  function render(): void {
    const count = (f: Filter) => entries.filter(([id, e]) => (f === "rejete" ? reviews[id] === "rejete" : f === "toutes" || (e.status === f && reviews[id] !== "rejete"))).length;
    const pending = entries.filter(([id, e]) => e.status === "a-verifier" && !reviews[id]).length;
    const tab = (f: Filter, label: string) => actionButton(null, `${label} (${count(f)})`, () => ((filter = f), render()), `small ${filter === f ? "primary" : "ghost"}`);

    const cards = entries
      .filter(([id, e]) => matches(id, e.status))
      .map(([imageId, entry]) => {
        const decision = reviews[imageId];
        const inGame = decision !== "rejete" && (entry.status === "sure" || decision === "ok");
        const decide = (d: CoverDecision | null) => async () => {
          reviews = await options.decide(imageId, d);
          render();
        };
        return h(
          "article",
          { class: `cover-card ${inGame ? "in-game" : "out"}` },
          h(
            "div",
            { class: "cover-pair" },
            h("img", { src: coverUrl(imageId), alt: `${entry.game} (originale)`, loading: "lazy" }),
            h("img", { src: entry.anonymized ? anonymizedCoverUrl(imageId) : coverUrl(imageId), alt: `${entry.game} (anonymisée)`, loading: "lazy" }),
          ),
          h("h3", {}, entry.game),
          h(
            "p",
            { class: "cover-flags" },
            entry.anonymized ? `${Math.round(entry.maskRatio * 100)} % effacé` : "aucun texte trouvé",
            ...entry.flags.map((f) => h("span", { class: "flag" }, FLAG_LABELS[f] ?? f)),
          ),
          h("p", { class: "cover-state" }, inGame ? "✔ posée en partie" : decision === "rejete" ? "✖ rejetée" : "en attente de validation"),
          h(
            "div",
            { class: "cover-actions" },
            actionButton(null, "Valider", decide("ok"), `small ${decision === "ok" ? "primary" : ""}`),
            actionButton(null, "Rejeter", decide("rejete"), `small ${decision === "rejete" ? "p1" : "ghost"}`),
            decision ? actionButton(null, "Annuler", decide(null), "small ghost") : null,
          ),
        );
      });

    screen.replaceChildren(
      h("h1", {}, "Relecture des jaquettes"),
      h(
        "p",
        { class: "muted" },
        `À gauche l'originale, à droite la version anonymisée posée en partie. Les jaquettes « à vérifier » ne sont posées qu'une fois validées. ${pending} en attente.`,
      ),
      h("div", { class: "review-tabs" }, tab("a-verifier", "À vérifier"), tab("sure", "Sûres"), tab("rejete", "Rejetées"), tab("toutes", "Toutes"), actionButton(null, "Retour", options.back, "small")),
      cards.length ? h("div", { class: "cover-grid" }, ...cards) : h("p", { class: "muted" }, "Rien dans cette catégorie."),
    );
  }

  render();
}
