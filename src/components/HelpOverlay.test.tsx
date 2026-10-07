import { describe, it, expect, mock } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { HelpOverlay } from "./HelpOverlay";

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const DOWN = "\x1b[B";

describe("HelpOverlay", () => {
  it("lists every section side by side when there's room", () => {
    const frame = render(<HelpOverlay onClose={() => {}} width={100} height={40} />).lastFrame() ?? "";
    for (const title of ["Anywhere", "Header", "Chats", "Messages", "Typing", "Reactions", "Media viewer"]) {
      expect(frame).toContain(title);
    }
    expect(frame).toMatch(/r\s+React, or remove your reaction/);
    expect(frame).toMatch(/R\s+Reply/);
    // Two columns: the first and a later section share a line
    expect(frame.split("\n").some((line) => line.includes("Anywhere") && line.includes("Messages"))).toBe(true);
    expect(frame).not.toContain("scroll");
  });

  it("scrolls when the list is taller than the screen", async () => {
    const { lastFrame, stdin } = render(<HelpOverlay onClose={() => {}} width={50} height={12} />);
    const first = lastFrame() ?? "";
    expect(first).toContain("Anywhere");
    expect(first).toMatch(/8\/\d+ · ↑↓ scroll/);

    stdin.write(DOWN);
    await wait();
    expect(lastFrame()).not.toContain("Anywhere");
    expect(lastFrame()).toMatch(/9\/\d+/);
  });

  it("closes on Esc, ? and q", async () => {
    for (const key of ["\x1b", "?", "q"]) {
      const onClose = mock(() => {});
      const { stdin } = render(<HelpOverlay onClose={onClose} width={100} height={40} />);
      stdin.write(key);
      await wait();
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });
});
