import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { StatusBar } from "./StatusBar";
import { SkinContext } from "./ui/SkinContext";

describe("StatusBar", () => {
  it("renders correctly when connected", () => {
    const { lastFrame } = render(
      <StatusBar connectionState="connected" focusedPanel="chatList" width={100} />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders correctly when connecting", () => {
    const { lastFrame } = render(
      <StatusBar connectionState="connecting" focusedPanel="chatList" width={100} />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders correctly when disconnected", () => {
    const { lastFrame } = render(
      <StatusBar connectionState="disconnected" focusedPanel="chatList" width={100} />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders with different focused panels", () => {
    const { lastFrame } = render(
      <StatusBar connectionState="connected" focusedPanel="messages" width={100} />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("drops the round border for a top rule under the claudeCode skin (default skin keeps it)", () => {
    const defaultFrame =
      render(<StatusBar connectionState="connected" focusedPanel="chatList" width={100} />).lastFrame() ?? "";
    const claudeCodeFrame =
      render(
        <SkinContext.Provider value="claudeCode">
          <StatusBar connectionState="connected" focusedPanel="chatList" width={100} />
        </SkinContext.Provider>,
      ).lastFrame() ?? "";

    expect(defaultFrame).toContain("╭");
    const claudeCodeLines = claudeCodeFrame.split("\n");
    expect(claudeCodeLines[0]).toMatch(/^─+$/);
    expect(claudeCodeFrame).not.toContain("╭");
  });

  it("labels the panel and keeps the label whole on narrow terminals", () => {
    const wide = render(<StatusBar connectionState="connected" focusedPanel="messages" width={100} />).lastFrame() ?? "";
    expect(wide).toContain("[Connected] Messages");
    expect(wide).toContain("r react · R reply · ← chats");

    const narrow = render(<StatusBar connectionState="connected" focusedPanel="messages" width={44} />).lastFrame() ?? "";
    expect(narrow).toContain("[Connected] Messages");
    expect(narrow).toContain("r react · R reply");
    expect(narrow).not.toContain("← chats");
    expect(narrow).not.toContain("…");
  });
});
