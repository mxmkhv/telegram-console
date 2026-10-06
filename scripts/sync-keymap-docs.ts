#!/usr/bin/env bun
/**
 * Regenerates the README shortcut tables from src/keymap.ts.
 *
 * Usage: bun run docs:keymap
 */

import { syncReadmeKeymap } from "../src/keymap";

const path = new URL("../README.md", import.meta.url).pathname;
await Bun.write(path, syncReadmeKeymap(await Bun.file(path).text()));
console.log("README.md keymap updated");
