import { describe, expect, it } from "vitest";
import { cleanArtist, cleanTitle, trackKey } from "../src/music/clean.ts";

describe("cleanTitle", () => {
  it.each([
    ["Sweet Dreams (Are Made of This) (2005 Remaster)", "Sweet Dreams (Are Made of This)"],
    ["Hungry Like the Wolf (2009 Remaster)", "Hungry Like the Wolf"],
    ["Mama (Remastered 2007)", "Mama"],
    ["La groupie du pianiste (Remasterisé en 2002)", "La groupie du pianiste"],
    ["Confidence pour confidence (Version originale 1981)", "Confidence pour confidence"],
    ["Flashdance...What a Feeling (Radio Edit)", "Flashdance...What a Feeling"],
    ["Bohemian Rhapsody - Remastered 2011", "Bohemian Rhapsody"],
    ["Take On Me - 2015 Remaster", "Take On Me"],
    ["Blinding Lights - Radio Edit", "Blinding Lights"],
    ["Titanium (feat. Sia)", "Titanium"],
    ["Titanium [feat. Sia]", "Titanium"],
    ["Stay (with Justin Bieber)", "Stay"],
    ["Despacito - Remix", "Despacito"],
    ["Levels - Skrillex Remix", "Levels"],
    ["Lean On (feat. MØ & DJ Snake) - Radio Edit", "Lean On"],
    ["It Might Be You (from \"Tootsie\") (Rerecorded)", "It Might Be You"],
    ["Hotel California - Live", "Hotel California"],
    ["Losing My Religion (Live at MTV Unplugged)", "Losing My Religion"],
    ["One More Time (Original Mix)", "One More Time"],
    ["Wonderwall (Remastered)", "Wonderwall"],
    ["All Too Well (Taylor's Version)", "All Too Well"],
    ["Get Lucky (Radio Edit) [feat. Pharrell Williams & Nile Rodgers]", "Get Lucky"],
    ["Feel It Still - Mono", "Feel It Still"],
    ["Dai Dai feat. Burna Boy", "Dai Dai"],
    ["My Heart Will Go On (Love Theme from \"Titanic\")", "My Heart Will Go On (Love Theme from \"Titanic\")"],
    ["Désenchantée (Version single)", "Désenchantée"],
    ["Ella, elle l'a - Version 2006", "Ella, elle l'a"],
    ["  Fallait pas commencer  ", "Fallait pas commencer"],
    ["Summertime Sadness (Lana Del Rey Vs. Cedric Gervais)", "Summertime Sadness"],
    ["This Girl (Kungs Vs Cookin' On 3 Burners)", "This Girl"],
    ["This One's for You (Official Song UEFA EURO 2016)", "This One's for You"],
    ["Argent Sale - A COLORS SHOW", "Argent Sale"],
    ["Émotif (Booska 1H)", "Émotif"],
  ])("%s → %s", (raw, expected) => {
    expect(cleanTitle(raw)).toBe(expected);
  });

  it("garde les parenthèses qui font partie du titre", () => {
    expect(cleanTitle("(I Can't Get No) Satisfaction")).toBe("(I Can't Get No) Satisfaction");
    expect(cleanTitle("Separate Ways (Worlds Apart)")).toBe("Separate Ways (Worlds Apart)");
    expect(cleanTitle("Don't You (Forget About Me)")).toBe("Don't You (Forget About Me)");
  });

  it("garde un tiret qui fait partie du titre", () => {
    expect(cleanTitle("Ob-La-Di, Ob-La-Da")).toBe("Ob-La-Di, Ob-La-Da");
    expect(cleanTitle("Tout - Tout de suite")).toBe("Tout - Tout de suite");
  });

  it("ne renvoie jamais un titre vide", () => {
    expect(cleanTitle("(Remastered)")).toBe("(Remastered)");
  });
});

describe("cleanArtist", () => {
  it("retire les invités", () => {
    expect(cleanArtist("David Guetta feat. Sia")).toBe("David Guetta");
    expect(cleanArtist("Simon & Garfunkel")).toBe("Simon & Garfunkel");
  });
});

describe("trackKey", () => {
  it("rapproche les versions d'un même morceau", () => {
    expect(trackKey("Bohemian Rhapsody - Remastered 2011", "Queen")).toBe(trackKey("Bohemian Rhapsody", "Queen"));
    expect(trackKey("Désenchantée", "Mylène Farmer")).toBe(trackKey("Desenchantee (Version single)", "Mylene Farmer"));
  });

  it("distingue deux artistes", () => {
    expect(trackKey("Hallelujah", "Leonard Cohen")).not.toBe(trackKey("Hallelujah", "Jeff Buckley"));
  });
});
