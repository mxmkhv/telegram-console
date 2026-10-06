import { describe, it, expect } from "bun:test";
import stringWidth from "string-width";
import { findCursorRow, moveCursorToRow, nextBoundary, previousBoundary, wrapInput } from "./inputLayout";

const rowTexts = (text: string, width: number) => wrapInput(text, width).map((r) => text.slice(r.start, r.end));

describe("wrapInput", () => {
  it("keeps short text on one row, and empty text has one row", () => {
    expect(rowTexts("hello", 10)).toEqual(["hello"]);
    expect(rowTexts("", 10)).toEqual([""]);
  });

  it("breaks after the last space that fits", () => {
    expect(rowTexts("hello big world", 10)).toEqual(["hello big ", "world"]);
  });

  it("lets a space hang past the edge instead of starting a row", () => {
    expect(rowTexts("hello world", 5)).toEqual(["hello ", "world"]);
  });

  it("hard-breaks a word longer than the row", () => {
    expect(rowTexts("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("starts a row at each newline, keeping blank lines", () => {
    expect(rowTexts("one\n\ntwo", 10)).toEqual(["one", "", "two"]);
  });

  it("measures emoji and CJK by their columns and never splits them", () => {
    const text = "👍🏽中文字👨‍👩‍👧";
    for (const row of rowTexts(text, 3)) expect(stringWidth(row)).toBeLessThanOrEqual(3);
    expect(rowTexts(text, 3).join("")).toBe(text);
    expect(rowTexts(text, 3)).toContain("👨‍👩‍👧");
  });

  it("never makes a row wider than asked", () => {
    const text = "x ab中中中 some words that wrap 你好世界 and 👍 more\nnext line";
    for (let width = 2; width < 20; width++) {
      const rows = wrapInput(text, width);
      for (const row of rows) {
        expect(stringWidth(text.slice(row.start, row.end).replace(/ $/, ""))).toBeLessThanOrEqual(width);
      }
      expect(rows.map((r) => text.slice(r.start, r.end)).join("")).toBe(text.replace(/\n/g, ""));
    }
  });
});

describe("findCursorRow", () => {
  const text = "hello big world\nend";
  const rows = wrapInput(text, 10); // "hello big ", "world", "end"

  it("puts the cursor at a wrapped row's end on the next row", () => {
    expect(findCursorRow(rows, 0)).toBe(0);
    expect(findCursorRow(rows, 10)).toBe(1);
  });

  it("keeps the cursor at the end of a line on that line", () => {
    expect(findCursorRow(rows, 15)).toBe(1);
    expect(findCursorRow(rows, 16)).toBe(2);
    expect(findCursorRow(rows, text.length)).toBe(2);
  });
});

describe("moveCursorToRow", () => {
  it("keeps the column, clamped to the target row", () => {
    const text = "hello big world\nend";
    const rows = wrapInput(text, 10);
    expect(moveCursorToRow(text, rows, 13, 0)).toBe(3); // "wor|ld" -> "hel|lo"
    expect(moveCursorToRow(text, rows, 8, 1)).toBe(text.indexOf("\n")); // past "world": its end
    expect(moveCursorToRow(text, rows, 18, 1)).toBe(12);
  });

  it("stays on a wrapped row instead of landing on the next one", () => {
    const text = "abcdefgh";
    const rows = wrapInput(text, 4); // "abcd", "efgh"
    expect(findCursorRow(rows, moveCursorToRow(text, rows, 8, 0))).toBe(0);
  });
});

describe("grapheme boundaries", () => {
  it("steps over a whole emoji", () => {
    const text = "a👨‍👩‍👧b";
    expect(previousBoundary(text, text.length - 1)).toBe(1);
    expect(nextBoundary(text, 1)).toBe(text.length - 1);
    expect(previousBoundary(text, 0)).toBe(0);
    expect(nextBoundary(text, text.length)).toBe(text.length);
  });
});
