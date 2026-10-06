import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { LogoutPrompt } from "./LogoutPrompt";
import type { LogoutMode } from "../types";

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const ENTER = "\r";
const ESC = "\x1b";
const RIGHT = "\x1b[C";

function setup() {
  const confirmed: LogoutMode[] = [];
  let cancelled = 0;
  const result = render(
    <LogoutPrompt onConfirm={(mode) => confirmed.push(mode)} onCancel={() => cancelled++} />
  );
  return { ...result, confirmed, cancelled: () => cancelled };
}

describe("LogoutPrompt", () => {
  it("logs out of the session on Enter", async () => {
    const { stdin, confirmed } = setup();
    await wait();
    stdin.write(ENTER);
    await wait();
    expect(confirmed).toEqual(["session"]);
  });

  it("asks for y before a full reset", async () => {
    const { stdin, lastFrame, confirmed } = setup();
    await wait();
    stdin.write(RIGHT);
    await wait();
    stdin.write(ENTER);
    await wait();
    expect(confirmed).toEqual([]);
    expect(lastFrame()).toContain("Press y to reset");

    // Another Enter must not confirm
    stdin.write(ENTER);
    await wait();
    expect(confirmed).toEqual([]);

    stdin.write("y");
    await wait();
    expect(confirmed).toEqual(["full"]);
  });

  it("Esc backs out of the full reset confirmation without cancelling", async () => {
    const { stdin, lastFrame, confirmed, cancelled } = setup();
    await wait();
    for (const key of [RIGHT, ENTER, ESC]) {
      stdin.write(key);
      await wait();
    }
    expect(lastFrame()).toContain("What would you like to clear?");
    expect(confirmed).toEqual([]);
    expect(cancelled()).toBe(0);
  });
});
