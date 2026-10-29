import countriesData from "../../data/countries.json";
import { flagUrl, type Country } from "../data/countries.ts";
import { poolProvider } from "./pool.ts";

export const capitals = poolProvider<Country>({
  id: "capitals",
  label: "Capitales",
  load: async () => countriesData as Country[],
  key: (c) => c.code,
  // Un continent tiré à parts égales, jamais deux fois de suite : l'Afrique (54 pays sur 195)
  // ne domine plus, et les questions varient.
  group: (c) => c.region,
  toQuestion: (c, id) => ({
    id,
    theme: "capitals",
    prompt: `Quelle est la capitale ${c.de} ?`,
    // Le drapeau illustre la question : le pays est déjà nommé, il ne donne pas d'indice.
    media: { type: "image", src: flagUrl(c) },
    answers: [{ label: "Capitale", value: c.capital }],
  }),
});
