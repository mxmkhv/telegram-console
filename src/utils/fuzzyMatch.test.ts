import { describe, it, expect } from "bun:test";
import { fuzzyMatch, rankByFuzzyMatch } from "./fuzzyMatch";

const titles = ["Elon Musk", "Donald Trump", "Tech Bros Anonymous", "AI Overlords", "Mark Zuckerberg"];
const rank = (query: string) => rankByFuzzyMatch(titles, query, (t) => t).map((r) => r.item);

describe("fuzzyMatch", () => {
  it("matches case-insensitively and marks the matched characters", () => {
    const match = fuzzyMatch("MUSK", "Elon Musk");
    expect(match).not.toBeNull();
    expect([...match!.matched]).toEqual([5, 6, 7, 8]);
  });

  it("matches characters in order across words", () => {
    expect(fuzzyMatch("tba", "Tech Bros Anonymous")).not.toBeNull();
    expect(fuzzyMatch("abt", "Tech Bros Anonymous")).toBeNull();
  });

  it("returns null when a character is missing", () => {
    expect(fuzzyMatch("xyz", "Elon Musk")).toBeNull();
  });

  it("marks a matched emoji by its start offset", () => {
    const match = fuzzyMatch("🚀", "Launch 🚀 team");
    expect([...match!.matched]).toEqual([7]);
  });

  it("keeps offsets aligned when lowercasing changes length", () => {
    // "İ" lowercases to two code units; "z" is still at offset 2 of the original
    const match = fuzzyMatch("z", "İaz");
    expect([...match!.matched]).toEqual([2]);
  });
});

describe("rankByFuzzyMatch", () => {
  it("keeps the original order for an empty query", () => {
    expect(rank("")).toEqual(titles);
  });

  it("ranks a word-start substring above a scattered match", () => {
    // "mark" is a word start in Mark Zuckerberg; in Tech Bros Anonymous it's scattered
    expect(rank("mar")[0]).toBe("Mark Zuckerberg");
  });

  it("ranks initials above weaker scattered matches", () => {
    expect(rank("ao")[0]).toBe("AI Overlords");
  });

  it("drops non-matching items", () => {
    expect(rank("trump")).toEqual(["Donald Trump"]);
  });
});
