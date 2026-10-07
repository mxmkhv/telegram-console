import { describe, it, expect, mock } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";

// SettingsPanel's handleSelect calls loadConfig()/saveConfig() with no
// customDir, i.e. the real ~/.config/telegram-console/config.json. Stub the
// module so interacting with the settings panel in tests never touches the
// developer's actual persisted config.
mock.module("../config", () => ({
  loadConfig: () => null,
  saveConfig: () => {},
}));

import { SettingsPanel } from "./SettingsPanel";
import { AppProvider } from "../state/context";
import type { SkinName } from "../types";

function renderPanel(initialSkin?: SkinName) {
  return render(
    <AppProvider initialSkin={initialSkin}>
      <SettingsPanel />
    </AppProvider>,
  );
}

const ESC = String.fromCharCode(27);
const DOWN = ESC + "[B";
const RIGHT = ESC + "[C";
const ENTER = String.fromCharCode(13);
const wait = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("SettingsPanel tabs", () => {
  it("shows the tab labels and defaults to the Layout tab", () => {
    const frame = renderPanel("default").lastFrame() ?? "";
    expect(frame).toContain("[ Layout ]");
    expect(frame).toContain("Skin");
    expect(frame).toContain("Notifications");
    expect(frame).toContain("Classic");
    expect(frame).toContain("Bubble");
    expect(frame).not.toContain("Claude Code");
  });

  it("switches to the Skin tab with the right arrow", async () => {
    const { stdin, lastFrame } = renderPanel("default");
    stdin.write(RIGHT);
    await wait();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Default");
    expect(frame).toContain("Claude Code");
    expect(frame).not.toContain("Classic");
  });

  it("marks the active skin as current on the Skin tab", async () => {
    const { stdin, lastFrame } = renderPanel("claudeCode");
    stdin.write(RIGHT);
    await wait();

    const frame = lastFrame() ?? "";
    const claudeCodeLine = frame
      .split("\n")
      .find((line) => line.includes("Claude Code"));
    expect(claudeCodeLine).toContain("(current)");
  });

  it("selects the Claude Code skin and updates the current marker", async () => {
    const { stdin, lastFrame } = renderPanel("default");
    stdin.write(RIGHT);
    await wait();
    stdin.write(DOWN);
    await wait();
    stdin.write(ENTER);
    await wait();

    const frame = lastFrame() ?? "";
    const claudeCodeLine = frame
      .split("\n")
      .find((line) => line.includes("Claude Code"));
    expect(claudeCodeLine).toContain("(current)");
  });
});

describe("SettingsPanel notifications", () => {
  it("is the third tab and saves the chosen mode", async () => {
    const { stdin, lastFrame } = renderPanel();
    stdin.write(RIGHT);
    await wait();
    stdin.write(RIGHT);
    await wait();
    expect(lastFrame()).toContain("[ Notifications ]");
    const currentLine = (lastFrame() ?? "").split("\n").find((line) => line.includes("(current)"));
    expect(currentLine).toContain("Bell and desktop notification");

    stdin.write(DOWN);
    await wait();
    stdin.write(ENTER);
    await wait();
    const bellLine = (lastFrame() ?? "").split("\n").find((line) => line.includes("Bell only"));
    expect(bellLine).toContain("(current)");
  });

  it("wraps from the first tab back to the last with the left arrow", async () => {
    const { stdin, lastFrame } = renderPanel();
    stdin.write(ESC + "[D");
    await wait();
    expect(lastFrame()).toContain("[ Typing ]");
  });
});

describe("SettingsPanel typing", () => {
  it("turns emoticon conversion off", async () => {
    const { stdin, lastFrame } = renderPanel();
    stdin.write(ESC + "[D");
    await wait();
    const currentLine = () => (lastFrame() ?? "").split("\n").find((line) => line.includes("(current)"));
    expect(currentLine()).toContain("Convert to emoji");

    stdin.write(DOWN);
    await wait();
    stdin.write(ENTER);
    await wait();
    expect(currentLine()).toContain("Keep as typed");
  });
});
