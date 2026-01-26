import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { InputBar } from "./InputBar";

describe("InputBar", () => {
  const mockOnSubmit = () => {};

  it("renders correctly when focused", () => {
    const { lastFrame } = render(
      <InputBar isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders correctly when unfocused", () => {
    const { lastFrame } = render(
      <InputBar isFocused={false} onSubmit={mockOnSubmit} selectedChatId="123" />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders with no chat selected", () => {
    const { lastFrame } = render(
      <InputBar isFocused={true} onSubmit={mockOnSubmit} selectedChatId={null} />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("cursor stays on same line after typing first character", async () => {
    const { lastFrame, stdin } = render(
      <InputBar isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" />
    );

    // Type a character
    stdin.write("a");

    // Wait for state update
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();
    // Split by newlines and check that content row has both 'a' and cursor on same line
    const lines = frame?.split("\n") ?? [];
    // The content should be on the second line (after top border)
    // Look for the line with "> " prefix that contains the typed character
    const contentLine = lines.find((line) => line.includes(">") && line.includes("a"));
    expect(contentLine).toBeDefined();
    // The cursor (inverse space) should be on the same line, not a separate line
    // If bug exists, 'a' would be on one line and cursor on next
    expect(lines.filter((line) => line.includes(">")).length).toBe(1);
  });
});
