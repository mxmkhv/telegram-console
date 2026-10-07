import { test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useTerminalSize } from "./useTerminalSize";

function Probe() {
  const { columns, rows } = useTerminalSize();
  return <Text>{`${columns}x${rows}`}</Text>;
}

test("returns the initial stdout dimensions", () => {
  const { lastFrame } = render(<Probe />);
  // ink-testing-library's mock stdout defaults to 100 columns; rows may be undefined → fallback 24
  expect(lastFrame()).toMatch(/^\d+x\d+$/);
});

test("leaves the terminal's last row free, so Ink never clears the screen to redraw", async () => {
  const { lastFrame, stdout } = render(<Probe />);
  Object.assign(stdout, { rows: 30 });
  stdout.emit("resize");
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(lastFrame()).toMatch(/x29$/);
});
