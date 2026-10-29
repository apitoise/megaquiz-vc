import countriesData from "../../data/countries.json";
import { flagUrl, type Country } from "../data/countries.ts";
import { poolProvider } from "./pool.ts";

export const capitals = poolProvider<Country>({
  id: "capitals",
  label: "Capitales",
  load: async () => countriesData as Country[],
  key: (c) => c.code,
  toQuestion: (c, id) => ({
    id,
    theme: "capitals",
    prompt: `Quelle est la capitale ${c.de} ?`,
    // Le drapeau illustre la question : le pays est déjà nommé, il ne donne pas d'indice.
    media: { type: "image", src: flagUrl(c) },
    answers: [{ label: "Capitale", value: c.capital }],
  }),
});
