import { readFileSync } from "fs";
import { fileURLToPath } from "url";

// The WebP decoder's WebAssembly, read from node_modules. The published
// build swaps this module for one with the bytes embedded (see scripts/build.ts):
// dist/index.js ships alone, and the decoder's own loader fetch()es a URL
// that doesn't exist there.
export function loadWebpWasm(): Uint8Array {
  return readFileSync(fileURLToPath(import.meta.resolve("@jsquash/webp/codec/dec/webp_dec.wasm")));
}
