#!/usr/bin/env bun
/**
 * Bundles the CLI into dist/index.js.
 *
 * Usage: bun run build
 */

// Ink loads React DevTools only when DEV=true, but a bundler can't tell, so
// all 270 KB of it would ship. Swap in a stub that says how to get them.
const DEVTOOLS_STUB = `throw new Error("React DevTools aren't in the published build. Run from source with DEV=true bun run dev, after installing react-devtools-core");
export default undefined;`;

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
  ],
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error("Build failed: see the errors above");
}
for (const output of result.outputs) {
  console.log(`${output.path.replace(`${process.cwd()}/`, "")}  ${(output.size / 1024 / 1024).toFixed(2)} MB`);
}
