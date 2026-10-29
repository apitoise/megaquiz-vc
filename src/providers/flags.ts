import countriesData from "../../data/countries.json";
import { countryAnswer, flagUrl, type Country } from "../data/countries.ts";
import { poolProvider } from "./pool.ts";

export const flags = poolProvider<Country>({
  id: "flags",
  label: "Drapeaux",
  load: async () => countriesData as Country[],
  key: (c) => c.code,
  toQuestion: (c, id) => ({
    id,
    theme: "flags",
    prompt: "De quel pays est ce drapeau ?",
    media: { type: "image", src: flagUrl(c) },
    answers: [{ label: "Pays", value: countryAnswer(c) }],
  }),
});
