import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { HINT_SEPARATOR, fitHints, getHints, getPanelHints, syncReadmeKeymap } from "./keymap";

describe("fitHints", () => {
  const items = ["? help", "^K go to chat", "Tab next panel"];

  it("joins every item that fits", () => {
    expect(fitHints(items, 100)).toBe("? help · ^K go to chat · Tab next panel");
  });

  it("drops whole items from the end instead of cutting one", () => {
    expect(fitHints(items, 30)).toBe("? help · ^K go to chat");
    expect(fitHints(items, 5)).toBe("");
  });

  it("never exceeds the width", () => {
    const all = getHints("global");
    for (let width = 0; width < 120; width++) {
      const line = fitHints(all, width);
      expect(line.length).toBeLessThanOrEqual(width);
      if (line) expect(line.split(HINT_SEPARATOR).every((item) => all.includes(item))).toBe(true);
    }
  });
});

describe("keymap hints", () => {
  it("shows lowercase r as react and uppercase R as reply", () => {
    expect(getPanelHints("messages")).toEqual(expect.arrayContaining(["r react", "R reply"]));
  });

  it("puts help first so narrow terminals keep it", () => {
    expect(getHints("global")[0]).toBe("? help");
  });
});

describe("README", () => {
  it("shortcut tables match the keymap", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    // Run `bun run docs:keymap` if this fails
    expect(syncReadmeKeymap(readme)).toBe(readme);
  });

  it("explains how to fix missing markers", () => {
    expect(() => syncReadmeKeymap("# no markers")).toThrow(/missing the keymap markers/);
  });
});
