import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { ReactionPicker, getPickerWindow } from "./ReactionPicker";

describe("ReactionPicker", () => {
  const defaultEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

  it("renders all emojis and more option", () => {
    const { lastFrame } = render(
      <ReactionPicker
        emojis={defaultEmojis}
        selectedIndex={0}
        onSelect={() => {}}
        onOpenModal={() => {}}
        onCancel={() => {}}
      />
    );
    const frame = lastFrame() ?? "";
    for (const emoji of defaultEmojis) {
      expect(frame).toContain(emoji);
    }
    expect(frame).toContain("[...]");
  });

  it("highlights selected emoji", () => {
    const { lastFrame } = render(
      <ReactionPicker
        emojis={defaultEmojis}
        selectedIndex={2}
        onSelect={() => {}}
        onOpenModal={() => {}}
        onCancel={() => {}}
      />
    );
    expect(lastFrame()).toMatchSnapshot();
  });
});

describe("getPickerWindow", () => {
  const widths = [4, 4, 4, 4, 4, 4, 7];

  it("shows everything when it fits", () => {
    expect(getPickerWindow(widths, 0, 31)).toEqual([0, 7]);
  });

  it("keeps the selection in view, filling the rest of the room", () => {
    expect(getPickerWindow(widths, 0, 20)).toEqual([0, 4]);
    expect(getPickerWindow(widths, 6, 20)).toEqual([4, 7]);
    expect(getPickerWindow(widths, 3, 20)).toEqual([2, 6]);
  });
});
