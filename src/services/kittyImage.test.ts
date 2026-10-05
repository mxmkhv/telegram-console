import { describe, it, expect } from "bun:test";
import { Jimp } from "jimp";
import { placeholderGridWindow, tintAlphaMask } from "./kittyImage.js";
import { DIACRITICS } from "./kittyDiacritics.js";

const PLACEHOLDER = "\u{10EEEE}";

// Strip the leading color set / trailing reset, split into cells, and decode the
// (row, col) diacritic pair each placeholder cell carries.
function decodeCells(gridLine: string): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  const chars = Array.from(gridLine);
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === PLACEHOLDER) {
      const rowCp = chars[i + 1]!.codePointAt(0)!;
      const colCp = chars[i + 2]!.codePointAt(0)!;
      cells.push({ row: DIACRITICS.indexOf(rowCp), col: DIACRITICS.indexOf(colCp) });
      i += 2;
    }
  }
  return cells;
}

describe("placeholderGridWindow", () => {
  it("produces winH lines of winW cells", () => {
    const grid = placeholderGridWindow(10, 10, 0, 0, 4, 3);
    const lines = grid.split("\n");
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(Array.from(line).filter((c) => c === PLACEHOLDER)).toHaveLength(4);
    }
  });

  it("carries absolute row/col diacritics at the given offset", () => {
    const grid = placeholderGridWindow(20, 20, 5, 3, 2, 2);
    const lines = grid.split("\n");
    // First row of the window maps to placement row 3, cols 5 and 6.
    expect(decodeCells(lines[0]!)).toEqual([
      { row: 3, col: 5 },
      { row: 3, col: 6 },
    ]);
    // Second row maps to placement row 4.
    expect(decodeCells(lines[1]!)).toEqual([
      { row: 4, col: 5 },
      { row: 4, col: 6 },
    ]);
  });

  it("clamps the offset so the window stays within the placement", () => {
    // Offset (9, 9) with a 3x3 window over a 10x10 placement clamps to (7, 7).
    const grid = placeholderGridWindow(10, 10, 9, 9, 3, 3);
    const first = decodeCells(grid.split("\n")[0]!)[0]!;
    expect(first).toEqual({ row: 7, col: 7 });
  });

  it("caps the window to the placement size", () => {
    const grid = placeholderGridWindow(3, 2, 0, 0, 10, 10);
    const lines = grid.split("\n");
    expect(lines).toHaveLength(2);
    expect(Array.from(lines[0]!).filter((c) => c === PLACEHOLDER)).toHaveLength(3);
  });
});

describe("tintAlphaMask", () => {
  it("recolors every pixel and keeps the alpha channel", async () => {
    const mask = new Jimp({ width: 2, height: 1, color: 0xffffffff });
    mask.setPixelColor(0xffffff80, 1, 0); // half-transparent white
    const png = (await mask.getBuffer("image/png")) as Buffer;

    const tinted = await Jimp.fromBuffer(await tintAlphaMask(png, "#D97757"));
    expect(tinted.getPixelColor(0, 0)).toBe(0xd97757ff);
    expect(tinted.getPixelColor(1, 0)).toBe(0xd9775780);
  });

  it("rejects colors that are not #rrggbb", async () => {
    const png = (await new Jimp({ width: 1, height: 1 }).getBuffer("image/png")) as Buffer;
    await expect(tintAlphaMask(png, "cyan")).rejects.toThrow('got "cyan"');
  });
});
