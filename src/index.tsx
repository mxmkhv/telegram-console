#!/usr/bin/env node
// Suppress GramJS logs before any imports
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
console.log = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("[") && args[0].includes("]")) return;
  originalConsoleLog(...args);
};
console.info = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("[") && args[0].includes("]")) return;
  originalConsoleInfo(...args);
};
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("[") && args[0].includes("]")) return;
  originalConsoleWarn(...args);
};

import { render } from "ink";
import { App } from "./app";

const useMock = process.argv.includes("--mock");

render(<App useMock={useMock} />);
