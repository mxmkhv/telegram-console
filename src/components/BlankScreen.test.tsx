import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { BlankScreen } from "./BlankScreen";

describe("BlankScreen", () => {
  it("shows only a dim hint, centered", () => {
    const lines = (render(<BlankScreen unread={5} height={9} />).lastFrame() ?? "").split("\n");
    expect(lines).toHaveLength(9);
    expect(lines.filter((line) => line.trim())).toEqual([expect.stringContaining("any key to return")]);
    expect(lines[4]).toContain("any key to return");
  });

  it("counts messages that arrive while hidden, never showing them", async () => {
    const { lastFrame, rerender } = render(<BlankScreen unread={5} height={3} />);
    expect(lastFrame()).not.toContain("new");
    rerender(<BlankScreen unread={7} height={3} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(lastFrame()).toContain("2 new · any key to return");
  });
});
