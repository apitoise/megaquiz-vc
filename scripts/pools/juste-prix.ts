// « Le juste prix » : prix et chiffres à estimer, le plus proche gagne.
// - prix et chiffres : liste curée (data/juste_prix_curated.json), illustrée par l'image de
//   l'article Wikipédia indiqué quand il y en a une ;
// - habitants : populations légales des grandes villes, depuis l'API Géo officielle (à jour).
import { readFile } from "node:fs/promises";
import type { PriceQuestion } from "../../src/data/juste-prix.ts";
import { fetchJson, writeJson } from "./http.ts";
import { imageUrl, pageProblem, pages } from "./wiki.ts";

/** Villes les plus peuplées utilisées pour les questions d'habitants. */
const CITY_COUNT = 20;

interface Curated {
  question: string;
  answer: string;
  wiki?: string | null;
}

interface Commune {
  nom: string;
  code: string;
  population?: number;
  codeDepartement: string;
}

export async function buildJustePrix(): Promise<void> {
  const curated = JSON.parse(await readFile("data/juste_prix_curated.json", "utf8")) as Record<string, Curated[]>;
  const titles = Object.values(curated)
    .flat()
    .map((c) => c.wiki)
    .filter((t): t is string => !!t);
  const found = await pages(titles);

  const questions: PriceQuestion[] = [];
  const missingImages: string[] = [];
  for (const [category, items] of Object.entries(curated)) {
    items.forEach((c, i) => {
      let image: string | null = null;
      if (c.wiki) {
        const page = found.get(c.wiki);
        const problem = pageProblem(page);
        if (problem) missingImages.push(`${c.wiki} (${problem})`);
        else image = imageUrl(page!);
      }
      questions.push({ id: `${category}-${String(i + 1).padStart(2, "0")}`, category, question: c.question, answer: c.answer, image });
    });
  }

  const communes = await fetchJson<Commune[]>("https://geo.api.gouv.fr/communes?fields=nom,code,centre,population,codeDepartement&format=json");
  const biggest = communes
    .filter((c) => c.population && /^(\d{2}|2A|2B)$/.test(c.codeDepartement))
    .sort((a, b) => b.population! - a.population!)
    .slice(0, CITY_COUNT);
  for (const c of biggest) {
    questions.push({
      id: `habitants-${c.code}`,
      category: "habitants",
      question: `Combien d'habitants compte la ville de ${c.nom} ?`,
      answer: `${c.population!.toLocaleString("fr-FR")} (population légale)`,
      image: null,
    });
  }

  await writeJson("data/juste_prix.json", questions);
  const count = (cat: string) => questions.filter((q) => q.category === cat).length;
  console.log(`  ${questions.length} questions : ${count("prix")} prix, ${count("chiffres")} chiffres, ${count("habitants")} habitants`);
  console.log(`  ${questions.filter((q) => q.image).length} illustrées`);
  for (const m of missingImages) console.log(`    sans image : ${m}`);
}
