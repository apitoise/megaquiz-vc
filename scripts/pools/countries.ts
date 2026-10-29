// Pool des pays : États membres de l'ONU + États observateurs (Vatican, Palestine).
// Données structurelles (codes, superficie) : mledoze/countries, la source de REST Countries.
// REST Countries v3.1 a été fermée (v5 exige une clé) ; ce dépôt public fournit les mêmes champs.
// Noms, « de… » et capitales en français : fichier curé data/capitals_fr.json.
import { readFile } from "node:fs/promises";
import type { Country } from "../../src/data/countries.ts";
import { fetchJson, writeJson } from "./http.ts";

const SOURCE = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";
/** États observateurs de l'ONU, ajoutés aux membres. */
const OBSERVERS = new Set(["VA", "PS"]);

interface SourceCountry {
  cca2: string;
  ccn3: string;
  unMember: boolean;
  area: number;
  region: Country["region"];
  name: { common: string };
}

interface Curated {
  name: string;
  aka?: string;
  de: string;
  capital: string;
  doubt?: string;
}

export async function buildCountries(): Promise<Country[]> {
  const source = await fetchJson<SourceCountry[]>(SOURCE);
  const curated = JSON.parse(await readFile("data/capitals_fr.json", "utf8")) as Record<string, Curated>;

  // NB : la source marque à tort le Vatican comme membre (194 « membres ») ; le résultat est le même.
  const states = source.filter((c) => c.unMember || OBSERVERS.has(c.cca2));
  const missing = states.filter((c) => !curated[c.cca2]);
  if (missing.length) {
    throw new Error(`Pays sans entrée dans data/capitals_fr.json : ${missing.map((c) => `${c.cca2} (${c.name.common})`).join(", ")}`);
  }
  const extra = Object.keys(curated).filter((code) => !states.some((c) => c.cca2 === code));
  if (extra.length) console.warn(`  Entrées curées hors pool (ignorées) : ${extra.join(", ")}`);

  const countries = states
    .map((c): Country => {
      const fr = curated[c.cca2];
      return {
        code: c.cca2,
        ccn3: c.ccn3,
        name: fr.name,
        ...(fr.aka ? { aka: fr.aka } : {}),
        de: fr.de,
        capital: fr.capital,
        area: c.area,
        region: c.region,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  await writeJson("data/countries.json", countries);
  const doubts = Object.entries(curated).filter(([, c]) => c.doubt);
  console.log(`  ${countries.length} pays (${states.length - OBSERVERS.size} membres de l'ONU + ${OBSERVERS.size} observateurs)`);
  console.log(`  ${doubts.length} capitales douteuses annotées dans data/capitals_fr.json`);
  return countries;
}
