import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { ShortcutsBar } from "./ShortcutsBar";
import { SkinContext } from "./ui/SkinContext";

describe("ShortcutsBar", () => {
  it("renders the shortcut legend", () => {
    const frame = render(<ShortcutsBar width={100} isTyping={false} />).lastFrame() ?? "";
    expect(frame).toContain("m minimal");
    expect(frame).toContain("c colors");
    expect(frame).toContain("Tab next panel");
  });

  it("renders a rule and the accent glyph above the legend under the claudeCode skin", () => {
    const frame =
      render(
        <SkinContext.Provider value="claudeCode">
          <ShortcutsBar width={100} isTyping={false} />
        </SkinContext.Provider>,
      ).lastFrame() ?? "";
    expect(frame).toContain("Tab next panel");
    expect(frame).toContain("⏵⏵");
    const lines = frame.split("\n");
    expect(lines[0]).toMatch(/^─+$/);
  });

  it("drops whole items on narrow terminals and keeps help", () => {
    const frame = render(<ShortcutsBar width={30} isTyping={false} />).lastFrame() ?? "";
    expect(frame.trim()).toBe("? help · ^K go to chat");
  });

  it("points the way out while typing, where letter keys just type", () => {
    const frame = render(<ShortcutsBar width={100} isTyping />).lastFrame() ?? "";
    expect(frame).toContain("^K go to chat · Esc then ? help");
    expect(frame).not.toContain("s settings");
  });
});
