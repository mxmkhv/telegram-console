import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { ChatSwitcher } from "./ChatSwitcher";
import type { Chat } from "../types";

const chats: Chat[] = [
  { id: "1", title: "Elon Musk", unreadCount: 2, isGroup: false },
  { id: "2", title: "Donald Trump", unreadCount: 0, isGroup: false },
  { id: "3", title: "Tech Bros Anonymous", unreadCount: 0, isGroup: true },
];

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const ENTER = "\r";
const ESC = "\x1b";
const DOWN = "\x1b[B";
const BACKSPACE = "\x7f";

function setup() {
  const selected: string[] = [];
  let closed = 0;
  const result = render(
    <ChatSwitcher chats={chats} onSelect={(id) => selected.push(id)} onClose={() => closed++} width={40} maxRows={5} />
  );
  return { ...result, selected, closed: () => closed };
}

async function type(stdin: { write: (s: string) => void }, ...keys: string[]) {
  for (const key of keys) {
    stdin.write(key);
    await wait();
  }
}

describe("ChatSwitcher", () => {
  it("lists every chat before anything is typed", async () => {
    const { lastFrame } = setup();
    await wait();
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Elon Musk (2)");
    expect(frame).toContain("Donald Trump");
    expect(frame).toContain("# Tech Bros Anonymous");
  });

  it("filters as you type and opens the best match on Enter", async () => {
    const { stdin, lastFrame, selected } = setup();
    await wait();
    await type(stdin, "t", "b", "a");
    expect(lastFrame()).toContain("Tech Bros Anonymous");
    expect(lastFrame()).not.toContain("Elon Musk");

    await type(stdin, ENTER);
    expect(selected).toEqual(["3"]);
  });

  it("moves the selection with the arrow keys", async () => {
    const { stdin, selected } = setup();
    await wait();
    await type(stdin, DOWN, ENTER);
    expect(selected).toEqual(["2"]);
  });

  it("keeps the selected chat when the list reorders", async () => {
    const selected: string[] = [];
    const props = { onSelect: (id: string) => selected.push(id), onClose: () => {}, width: 40, maxRows: 5 };
    const { stdin, rerender } = render(<ChatSwitcher chats={chats} {...props} />);
    await wait();
    await type(stdin, DOWN); // Donald Trump

    // A new message moves Tech Bros to the top
    rerender(<ChatSwitcher chats={[chats[2]!, chats[0]!, chats[1]!]} {...props} />);
    await wait();
    await type(stdin, ENTER);
    expect(selected).toEqual(["2"]);
  });

  it("shows an empty state, and backspace recovers from it", async () => {
    const { stdin, lastFrame, selected } = setup();
    await wait();
    await type(stdin, "z", "z");
    expect(lastFrame()).toContain('No chats match "zz"');

    await type(stdin, ENTER);
    expect(selected).toEqual([]);

    await type(stdin, BACKSPACE, BACKSPACE);
    expect(lastFrame()).toContain("Elon Musk");
  });

  it("closes on Esc", async () => {
    const { stdin, closed } = setup();
    await wait();
    await type(stdin, ESC);
    expect(closed()).toBe(1);
  });
});
