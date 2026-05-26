// esbuild-based bundler that ships the DR compute pipeline as a single
// IIFE the standalone HTML can <script>-include. The bundle attaches
// parseSave / listCharacters / computeCorganDropRate / flattenTree /
// buildMapOptions onto globalThis.DRMax.

import { build } from "esbuild";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");

(async () => {
  const result = await build({
    entryPoints: [resolve(repoRoot, "web/lib/dropRate/maxToolEntry.ts")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    minify: true,
    sourcemap: false,
    write: true,
    outfile: resolve(repoRoot, "web/data/dr-compute-bundle.js"),
    // The tsconfig path alias `@/*` maps to web/*. Mirror that so the
    // bundler can resolve `@/lib/...` imports inside our compute code.
    alias: { "@": resolve(repoRoot, "web") },
    // Keep console logs etc. but drop debugger / __DEV__ branches.
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    // Suppress harmless "this is undefined at top level" warnings the
    // corgan-source CJS files emit; esbuild has no real complaints here.
    logLevel: "warning",
  });
  if (result.errors.length > 0) {
    console.error(result.errors);
    process.exit(1);
  }
  const outPath = resolve(repoRoot, "web/data/dr-compute-bundle.js");
  const fs = await import("node:fs");
  const stat = fs.statSync(outPath);
  console.log(`✓ Bundle: ${outPath}  (${(stat.size / 1024).toFixed(1)} KB)`);
})();
