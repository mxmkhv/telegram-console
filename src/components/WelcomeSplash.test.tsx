import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { WelcomeSplash } from "./WelcomeSplash";

describe("WelcomeSplash", () => {
  it("renders correctly", () => {
    const { lastFrame } = render(<WelcomeSplash onContinue={() => {}} />);
    expect(lastFrame()).toMatchSnapshot();
  });

  it("shows version number", () => {
    const { lastFrame } = render(<WelcomeSplash onContinue={() => {}} />);
    const frame = lastFrame();
    expect(frame).toMatch(/v\d+\.\d+\.\d+/);
  });

  it("shows press any key hint", () => {
    const { lastFrame } = render(<WelcomeSplash onContinue={() => {}} />);
    const frame = lastFrame();
    expect(frame).toContain("Press any key to continue");
  });

  it("calls onContinue when any key is pressed", () => {
    let called = false;
    const { stdin } = render(
      <WelcomeSplash onContinue={() => { called = true; }} />
    );
    stdin.write("a");
    expect(called).toBe(true);
  });
});
