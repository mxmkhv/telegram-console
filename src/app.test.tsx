import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { App } from "./app";

describe("App Integration", () => {
  it("renders without crashing in mock mode", () => {
    const { lastFrame } = render(<App useMock />);
    expect(lastFrame()).toBeDefined();
  });

  it("shows setup screen when no config exists", () => {
    const { lastFrame } = render(<App useMock />);
    const frame = lastFrame();
    // Without config, Setup is shown first (which contains "Welcome to telegram-console-client!")
    // WelcomeSplash is shown after setup completes
    expect(frame).toContain("Welcome to telegram-console-client");
  });
});
