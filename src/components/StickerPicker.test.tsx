import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { StickerPicker } from "./StickerPicker";
import type { Sticker, StickerSource } from "../types";

const SOURCES: StickerSource[] = [
  { kind: "recent", title: "Recent" },
  { kind: "faved", title: "Favorites" },
  { kind: "pack", id: "cats", title: "Cats" },
];

const stickers = (prefix: string, emojis: string[]): Sticker[] =>
  emojis.map((emoji, i) => ({ id: `${prefix}-${i}`, emoji, isAnimated: false }));

const STICKERS: Record<string, Sticker[]> = {
  recent: stickers("recent", ["😊", "👍", "🔥"]),
  faved: [],
  cats: stickers("cats", ["🐱", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🐈", "🐾"]),
};

const keyOf = (source: StickerSource) => (source.kind === "pack" ? source.id : source.kind);

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const ENTER = "\r";
const ESC = "\x1b";
const TAB = "\t";
const SHIFT_TAB = "\x1b[Z";
const RIGHT = "\x1b[C";
const DOWN = "\x1b[B";
const CTRL_R = "\x12";

function setup(overrides: Partial<React.ComponentProps<typeof StickerPicker>> = {}) {
  const sent: Sticker[] = [];
  let closed = 0;
  const result = render(
    <StickerPicker
      loadSources={async () => SOURCES}
      loadStickers={async (source) => STICKERS[keyOf(source)]!}
      onSelect={(sticker) => sent.push(sticker)}
      onClose={() => closed++}
      // 4 for the border and padding, then six 4-wide cells
      width={28}
      rows={1}
      {...overrides}
    />,
  );
  return { ...result, sent, closed: () => closed };
}

// The frame's text with the border and wrapping taken out
const text = (frame: string | undefined) => (frame ?? "").replace(/[│\s]+/g, " ");

async function press(stdin: { write: (s: string) => void }, ...keys: string[]) {
  for (const key of keys) {
    stdin.write(key);
    await wait();
  }
}

describe("StickerPicker", () => {
  it("opens on recent stickers, with a tab per pack", async () => {
    const { lastFrame } = setup();
    await wait();
    const frame = lastFrame()!;
    expect(frame).toContain("Send a sticker");
    expect(frame).toContain("Recent");
    expect(frame).toContain("Favorites");
    expect(frame).toContain("😊  👍  🔥");
    expect(frame).toContain("1/3");
  });

  it("sends the chosen sticker", async () => {
    const { stdin, sent } = setup();
    await wait();
    await press(stdin, RIGHT, RIGHT, ENTER);
    expect(sent.map((s) => s.id)).toEqual(["recent-2"]);
  });

  it("Tab and Shift+Tab switch packs, wrapping around", async () => {
    const { stdin, lastFrame } = setup();
    await wait();
    await press(stdin, SHIFT_TAB);
    expect(lastFrame()).toContain("🐱");

    await press(stdin, TAB, TAB);
    expect(lastFrame()).toContain("No favorites");
  });

  it("scrolls the grid to keep the selection in view", async () => {
    const { stdin, lastFrame, sent } = setup();
    await wait();
    await press(stdin, SHIFT_TAB);
    expect(lastFrame()).not.toContain("🐈");

    // Down from the 2nd of 6 columns lands on the 8th sticker, in the hidden second row
    await press(stdin, RIGHT, DOWN);
    expect(lastFrame()).toContain("🐈");
    expect(lastFrame()).not.toContain("🐱");
    expect(lastFrame()).toContain("8/12");

    await press(stdin, ENTER);
    expect(sent.map((s) => s.emoji)).toEqual(["🙀"]);
  });

  it("an arrow pressed while a tab loads leaves the first sticker selected", async () => {
    let finish = () => {};
    const { stdin, lastFrame, sent } = setup({
      loadStickers: (source) => new Promise((resolve) => (finish = () => resolve(STICKERS[keyOf(source)]!))),
    });
    await wait();
    await press(stdin, RIGHT);
    finish();
    await wait();
    await press(stdin, ENTER);
    expect(lastFrame()).toContain("1/3");
    expect(sent.map((s) => s.id)).toEqual(["recent-0"]);
  });

  it("names who the sticker replies to", async () => {
    const { lastFrame } = setup({ replyingTo: "Donald", width: 44 });
    await wait();
    expect(lastFrame()).toContain("Reply to Donald with a sticker");
  });

  it("Esc closes without sending", async () => {
    const { stdin, sent, closed } = setup();
    await wait();
    await press(stdin, ESC);
    expect(closed()).toBe(1);
    expect(sent).toEqual([]);
  });

  it("says why packs didn't load, and Ctrl+R retries", async () => {
    let fail = true;
    const { stdin, lastFrame } = setup({
      rows: 3,
      loadSources: async () => {
        if (fail) throw new Error("FLOOD_WAIT_3");
        return SOURCES;
      },
    });
    await wait();
    expect(text(lastFrame())).toContain("Couldn't load your sticker packs: ^R to retry (FLOOD_WAIT_3)");

    fail = false;
    await press(stdin, CTRL_R);
    expect(lastFrame()).toContain("😊");
  });

  it("retries just the pack that failed", async () => {
    const loads: string[] = [];
    let fail = true;
    const { stdin, lastFrame } = setup({
      rows: 3,
      loadStickers: async (source) => {
        loads.push(keyOf(source));
        if (source.kind === "pack" && fail) throw new Error("timed out");
        return STICKERS[keyOf(source)]!;
      },
    });
    await wait();
    await press(stdin, SHIFT_TAB);
    expect(text(lastFrame())).toContain("Couldn't load Cats: ^R to retry (timed out)");

    fail = false;
    await press(stdin, CTRL_R);
    expect(lastFrame()).toContain("🐱");
    expect(loads).toEqual(["recent", "cats", "cats"]);
  });

  it("a pack left while loading has loaded when you're back", async () => {
    const pending: Array<() => void> = [];
    const { stdin, lastFrame } = setup({
      loadStickers: (source) =>
        new Promise((resolve) => pending.push(() => resolve(STICKERS[keyOf(source)]!))),
    });
    await wait();
    // Recent is loading; move on before it finishes
    await press(stdin, TAB);
    for (const finish of pending.splice(0)) finish();
    await press(stdin, SHIFT_TAB);
    expect(lastFrame()).toContain("😊  👍  🔥");
  });
});
