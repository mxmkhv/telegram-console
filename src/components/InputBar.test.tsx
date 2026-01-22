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
});
