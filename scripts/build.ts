#!/usr/bin/env bun
/**
 * Bundles the CLI into dist/index.js.
 *
 * Usage: bun run build
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";

// Ink loads React DevTools only when DEV=true, but a bundler can't tell, so
// all 270 KB of it would ship. Swap in a stub that says how to get them.
const DEVTOOLS_STUB = `throw new Error("React DevTools aren't in the published build. Run from source with DEV=true bun run dev, after installing react-devtools-core");
export default undefined;`;

// src/services/webpWasm.ts reads the WebP decoder from node_modules, which
// isn't there once installed from npm. Embed the bytes instead (~180 KB).
// Bun's own base64 loader can't: as of Bun 1.4.0 it returns the file's text or
// an empty string.
const webpWasm = readFileSync(fileURLToPath(import.meta.resolve("@jsquash/webp/codec/dec/webp_dec.wasm")));
const WEBP_WASM_EMBEDDED = `export function loadWebpWasm() { return Buffer.from("${webpWasm.toString("base64")}", "base64"); }`;
let embeddedWebpWasm = false;

const result = await Bun.build({
  entrypoints: ["src/index.tsx"],
  outdir: "dist",
  target: "node",
  minify: true,
  plugins: [
    {
      name: "without-react-devtools",
      setup(build) {
        build.onResolve({ filter: /^react-devtools-core$/ }, () => ({ path: "react-devtools-core", namespace: "stub" }));
        build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: DEVTOOLS_STUB, loader: "js" }));
      },
    },
    {
      name: "embedded-webp-wasm",
      setup(build) {
        build.onLoad({ filter: /[\\/]src[\\/]services[\\/]webpWasm\.ts$/ }, () => {
          embeddedWebpWasm = true;
          return { contents: WEBP_WASM_EMBEDDED, loader: "js" };
        });
      },
    },
  ],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error("Build failed: see the errors above");
}
// Otherwise the bundle would ship reading node_modules, and no sticker would open
if (!embeddedWebpWasm) {
  throw new Error("Build failed: src/services/webpWasm.ts wasn't replaced. Update the embedded-webp-wasm plugin's filter to its new path");
}
for (const output of result.outputs) {
  console.log(`${output.path.replace(`${process.cwd()}/`, "")}  ${(output.size / 1024 / 1024).toFixed(2)} MB`);
}
