import { describe, expect, it } from "vitest";
import { foldSq, matchesQuery } from "@/lib/search";

describe("foldSq", () => {
  it("unaccents the two letters Albanian names actually carry", () => {
    expect(foldSq("REÇICA")).toBe("recica");
    expect(foldSq("Reçica")).toBe("recica");
    expect(foldSq("Blerinë Krasniqi")).toBe("blerine krasniqi");
    expect(foldSq("Gëzim Çabrati")).toBe("gezim cabrati");
  });

  it("reduces punctuation to single spaces and trims", () => {
    expect(foldSq("  Imeri-Ajeti  ")).toBe("imeri ajeti");
    expect(foldSq("FOKUS LBK SH.P.K")).toBe("fokus lbk sh p k");
  });

  it("survives null and undefined", () => {
    expect(foldSq(null)).toBe("");
    expect(foldSq(undefined)).toBe("");
  });
});

describe("matchesQuery", () => {
  it("finds an accented name from an unaccented query", () => {
    // The regression: this is false on the old .toLowerCase().includes().
    expect(matchesQuery("Recica", "Arben REÇICA")).toBe(true);
  });

  it("finds an unaccented name from an accented query", () => {
    // The half-fix trap — folding only the haystack fails this one.
    expect(matchesQuery("REÇ", "Arben Recica")).toBe(true);
    expect(matchesQuery("Blerinë", "Blerine Krasniqi")).toBe(true);
  });

  it("ANDs terms across fields regardless of order", () => {
    expect(matchesQuery("arta shitje", "Arta Krasniqi", "Shitje")).toBe(true);
    expect(matchesQuery("shitje arta", "Arta Krasniqi", "Shitje")).toBe(true);
    expect(matchesQuery("arta marketing", "Arta Krasniqi", "Shitje")).toBe(false);
  });

  it("matches mid-word, not just at a token start", () => {
    expect(matchesQuery("eqir", "Bulza Beqiri")).toBe(true);
  });

  it("treats an empty query as matching everything", () => {
    expect(matchesQuery("", "anything")).toBe(true);
    expect(matchesQuery("   ", "anything")).toBe(true);
    expect(matchesQuery(null, "anything")).toBe(true);
  });

  it("does not throw on null fields, and no readable field means no match", () => {
    expect(matchesQuery("arta", null, undefined, "Arta")).toBe(true);
    expect(matchesQuery("arta", null, undefined)).toBe(false);
  });

  it("does not join across stripped punctuation — a stated limit", () => {
    expect(foldSq("O'Brien-Smith")).toBe("o brien smith");
    expect(matchesQuery("obrien", "O'Brien")).toBe(false);
    expect(matchesQuery("brien", "O'Brien")).toBe(true);
  });
});
