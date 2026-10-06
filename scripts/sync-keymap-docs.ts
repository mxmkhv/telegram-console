#!/usr/bin/env bun
/**
 * Regenerates the README shortcut tables from src/keymap.ts.
 *
 * Usage: bun run docs:keymap
 */

import { fileURLToPath } from "node:url";
import { syncReadmeKeymap } from "../src/keymap";

const path = fileURLToPath(new URL("../README.md", import.meta.url));
await Bun.write(path, syncReadmeKeymap(await Bun.file(path).text()));
console.log("README.md keymap updated");
