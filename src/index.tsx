#!/usr/bin/env node
// Suppress GramJS logs before any imports
const isGramJSLog = (str: string) => /^\[[\d-T:.]+\] \[(INFO|WARN|ERROR|DEBUG)\]/.test(str);

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

process.stdout.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
  if (typeof chunk === "string" && isGramJSLog(chunk)) return true;
  return originalStdoutWrite(chunk, ...(args as []));
}) as typeof process.stdout.write;

process.stderr.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
  if (typeof chunk === "string" && isGramJSLog(chunk)) return true;
  return originalStderrWrite(chunk, ...(args as []));
}) as typeof process.stderr.write;

import { render } from "ink";
import { App } from "./app";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

// Handle version flag
if (process.argv.includes("-v") || process.argv.includes("--version")) {
  console.log(pkg.version);
  process.exit(0);
}

// Handle help flag
if (process.argv.includes("-h") || process.argv.includes("--help")) {
  console.log(`
telegram-console v${pkg.version}

A terminal-based Telegram client

Usage: telegram-console [options]

Options:
  -v, --version   Show version
  -h, --help      Show this help
  --auth-qr       Authenticate via QR code (default)
  --incognito     Don't persist session to disk
  --mock          Use mock service for testing
`);
  process.exit(0);
}

const useMock = process.argv.includes("--mock");
const incognito = process.argv.includes("--incognito");

// Escapes go straight to the terminal: they print nothing, so Ink's frame is unaffected
const writeToTerminal = process.stdout.isTTY ? (data: string) => void process.stdout.write(data) : undefined;

// Rewrite only the lines that changed: redrawing every line on each update flickers
render(<App useMock={useMock} incognito={incognito} writeToTerminal={writeToTerminal} />, { incrementalRendering: true });
