// ===== TALENT ICONS COPIER =====
// One-shot script: copies the UISkillIcon*.png files from the vendored
// IT source tree (web/scripts/it-source/public/data/) into the Next.js
// public folder so the /talents-level page can reference them at
// /talent-icons/UISkillIcon{N}.png.
//
// Run with: `npx tsx web/scripts/copy-talent-icons.ts`
//
// Idempotent — skips files that already exist with identical size, so
// re-running after pulling a fresh IT data dump only copies what changed.

import { readdirSync, statSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..");
const SRC = join(REPO, "web", "scripts", "it-source", "public", "data");
const DST = join(REPO, "web", "public", "talent-icons");

function main(): void {
  if (!existsSync(SRC)) {
    console.error(`Source dir missing: ${SRC}`);
    process.exit(1);
  }
  mkdirSync(DST, { recursive: true });

  const files = readdirSync(SRC).filter(
    (f) => f.startsWith("UISkillIcon") && f.endsWith(".png")
  );

  let copied = 0;
  let skipped = 0;
  let totalBytes = 0;
  for (const f of files) {
    const src = join(SRC, f);
    const dst = join(DST, f);
    const srcSize = statSync(src).size;
    totalBytes += srcSize;
    if (existsSync(dst) && statSync(dst).size === srcSize) {
      skipped++;
      continue;
    }
    copyFileSync(src, dst);
    copied++;
  }
  const mb = (totalBytes / 1024 / 1024).toFixed(2);
  console.log(`✓ Talent icons → ${DST}`);
  console.log(`  ${files.length} files (${mb} MB) — copied ${copied}, skipped ${skipped}`);
}

main();
