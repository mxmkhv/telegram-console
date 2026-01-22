import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  it("renders correctly when connected", () => {
    const { lastFrame } = render(
      <StatusBar connectionState="connected" focusedPanel="chatList" />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders correctly when connecting", () => {
    const { lastFrame } = render(
      <StatusBar connectionState="connecting" focusedPanel="chatList" />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders correctly when disconnected", () => {
    const { lastFrame } = render(
      <StatusBar connectionState="disconnected" focusedPanel="chatList" />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders with different focused panels", () => {
    const { lastFrame } = render(
      <StatusBar connectionState="connected" focusedPanel="messages" />
    );
    expect(lastFrame()).toMatchSnapshot();
  });
});
