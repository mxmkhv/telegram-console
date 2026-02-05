import { describe, it, expect } from "bun:test";
import { transformEmoticons, EMOTICON_MAP } from "./emoticonMap";

describe("transformEmoticons", () => {
  describe("basic emoticon transformations", () => {
    it("transforms :) to slightly smiling face", () => {
      const result = transformEmoticons(":) ", 3);
      expect(result.text).toBe("\u{1F642} ");
    });

    it("transforms :-) to slightly smiling face", () => {
      const result = transformEmoticons(":-) ", 4);
      expect(result.text).toBe("\u{1F642} ");
    });

    it("transforms :D to grinning face", () => {
      const result = transformEmoticons(":D ", 3);
      expect(result.text).toBe("\u{1F603} ");
    });

    it("transforms :( to frowning face", () => {
      const result = transformEmoticons(":( ", 3);
      expect(result.text).toBe("\u{1F641} ");
    });

    it("transforms ;) to winking face", () => {
      const result = transformEmoticons(";) ", 3);
      expect(result.text).toBe("\u{1F609} ");
    });

    it("transforms :P to face with tongue", () => {
      const result = transformEmoticons(":P ", 3);
      expect(result.text).toBe("\u{1F61B} ");
    });

    it("transforms :p (lowercase) to face with tongue", () => {
      const result = transformEmoticons(":p ", 3);
      expect(result.text).toBe("\u{1F61B} ");
    });

    it("transforms <3 to red heart", () => {
      const result = transformEmoticons("<3 ", 3);
      expect(result.text).toBe("\u{2764}\u{FE0F} ");
    });

    it("transforms </3 to broken heart", () => {
      const result = transformEmoticons("</3 ", 4);
      expect(result.text).toBe("\u{1F494} ");
    });

    it("transforms :/ to confused face", () => {
      const result = transformEmoticons(":/ ", 3);
      expect(result.text).toBe("\u{1F615} ");
    });

    it("transforms B) to sunglasses face", () => {
      const result = transformEmoticons("B) ", 3);
      expect(result.text).toBe("\u{1F60E} ");
    });

    it("transforms :'( to crying face", () => {
      const result = transformEmoticons(":'( ", 4);
      expect(result.text).toBe("\u{1F622} ");
    });

    it("transforms :* to kiss face", () => {
      const result = transformEmoticons(":* ", 3);
      expect(result.text).toBe("\u{1F618} ");
    });
  });

  describe("cursor position adjustments", () => {
    it("returns zero adjustment when emoji length equals emoticon length", () => {
      // :) is 2 chars, 🙂 is 2 chars (surrogate pair)
      const result = transformEmoticons(":) ", 3);
      expect(result.cursorAdjustment).toBe(0);
    });

    it("returns negative adjustment when emoji is shorter than emoticon", () => {
      // :-) is 3 chars, 🙂 is 2 chars
      const result = transformEmoticons(":-) ", 4);
      expect(result.cursorAdjustment).toBe(-1);
    });

    it("returns positive adjustment when emoji is longer than emoticon", () => {
      // :shrug: is 7 chars, ¯\_(ツ)_/¯ is 9 chars
      const result = transformEmoticons(":shrug: ", 8);
      expect(result.cursorAdjustment).toBe(2);
    });

    it("returns zero adjustment when no transformation occurs", () => {
      const result = transformEmoticons("hello ", 6);
      expect(result.cursorAdjustment).toBe(0);
    });
  });

  describe("edge cases - position in string", () => {
    it("transforms emoticon at start of string", () => {
      const result = transformEmoticons(":) hello", 3);
      expect(result.text).toBe("\u{1F642} hello");
    });

    it("transforms emoticon at end of string without trailing space", () => {
      const result = transformEmoticons("hello :)", 8);
      expect(result.text).toBe("hello \u{1F642}");
    });

    it("transforms emoticon followed by space", () => {
      const result = transformEmoticons("hello :) ", 9);
      expect(result.text).toBe("hello \u{1F642} ");
      expect(result.cursorAdjustment).toBe(0);
    });

    it("transforms emoticon in middle of text", () => {
      const result = transformEmoticons("hello :) world", 9);
      expect(result.text).toBe("hello \u{1F642} world");
    });

    it("handles multiple words with emoticon at end", () => {
      const result = transformEmoticons("this is a test :D ", 18);
      expect(result.text).toBe("this is a test \u{1F603} ");
    });

    it("transforms only the last emoticon before cursor", () => {
      const result = transformEmoticons(":) hello :D ", 12);
      expect(result.text).toBe(":) hello \u{1F603} ");
    });
  });

  describe("edge cases - no transformation", () => {
    it("returns unchanged text when no emoticon matches", () => {
      const result = transformEmoticons("hello world ", 12);
      expect(result.text).toBe("hello world ");
      expect(result.cursorAdjustment).toBe(0);
    });

    it("returns unchanged for partial emoticon (just colon)", () => {
      const result = transformEmoticons(": ", 2);
      expect(result.text).toBe(": ");
      expect(result.cursorAdjustment).toBe(0);
    });

    it("returns unchanged for incomplete emoticon", () => {
      const result = transformEmoticons(":- ", 3);
      expect(result.text).toBe(":- ");
      expect(result.cursorAdjustment).toBe(0);
    });

    it("returns unchanged for empty string", () => {
      const result = transformEmoticons("", 0);
      expect(result.text).toBe("");
      expect(result.cursorAdjustment).toBe(0);
    });

    it("returns unchanged when cursor is at position 0", () => {
      const result = transformEmoticons(":) hello", 0);
      expect(result.text).toBe(":) hello");
      expect(result.cursorAdjustment).toBe(0);
    });
  });

  describe("URL-like text handling", () => {
    it("does not transform :/ inside URL", () => {
      const result = transformEmoticons("http://example.com ", 19);
      expect(result.text).toBe("http://example.com ");
      expect(result.cursorAdjustment).toBe(0);
    });

    it("does not transform emoticon-like sequences inside URLs", () => {
      const result = transformEmoticons("https://site.com/path ", 22);
      expect(result.text).toBe("https://site.com/path ");
    });

    it("does not transform when emoticon is part of a larger word", () => {
      const result = transformEmoticons("test:) ", 7);
      expect(result.text).toBe("test:) ");
      expect(result.cursorAdjustment).toBe(0);
    });

    it("transforms emoticon that is a standalone word after URL", () => {
      const result = transformEmoticons("http://example.com :) ", 22);
      expect(result.text).toBe("http://example.com \u{1F642} ");
    });
  });

  describe("text shortcuts", () => {
    it("transforms :shrug: to shrug kaomoji", () => {
      const result = transformEmoticons(":shrug: ", 8);
      expect(result.text).toBe("\u{00AF}\\_(\u{30C4})_/\u{00AF} ");
    });

    it("transforms :thumbsup: to thumbs up emoji", () => {
      const result = transformEmoticons(":thumbsup: ", 11);
      expect(result.text).toBe("\u{1F44D} ");
    });

    it("transforms :thumbsdown: to thumbs down emoji", () => {
      const result = transformEmoticons(":thumbsdown: ", 13);
      expect(result.text).toBe("\u{1F44E} ");
    });

    it("transforms :fire: to fire emoji", () => {
      const result = transformEmoticons(":fire: ", 7);
      expect(result.text).toBe("\u{1F525} ");
    });

    it("transforms :heart: to heart emoji", () => {
      const result = transformEmoticons(":heart: ", 8);
      expect(result.text).toBe("\u{2764}\u{FE0F} ");
    });

    it("transforms :star: to star emoji", () => {
      const result = transformEmoticons(":star: ", 7);
      expect(result.text).toBe("\u{2B50} ");
    });

    it("transforms :check: to check mark emoji", () => {
      const result = transformEmoticons(":check: ", 8);
      expect(result.text).toBe("\u{2705} ");
    });

    it("transforms :x: to cross mark emoji", () => {
      const result = transformEmoticons(":x: ", 4);
      expect(result.text).toBe("\u{274C} ");
    });

    it("does not transform unknown text shortcuts", () => {
      const result = transformEmoticons(":unknown: ", 10);
      expect(result.text).toBe(":unknown: ");
      expect(result.cursorAdjustment).toBe(0);
    });
  });

  describe("EMOTICON_MAP export", () => {
    it("exports EMOTICON_MAP with expected keys", () => {
      expect(EMOTICON_MAP[":)"]).toBe("\u{1F642}");
      expect(EMOTICON_MAP[":D"]).toBe("\u{1F603}");
      expect(EMOTICON_MAP["<3"]).toBe("\u{2764}\u{FE0F}");
      expect(EMOTICON_MAP[":shrug:"]).toBe("\u{00AF}\\_(\u{30C4})_/\u{00AF}");
    });
  });
});
