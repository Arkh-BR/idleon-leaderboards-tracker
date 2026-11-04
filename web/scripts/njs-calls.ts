// njs-calls: which calls does the game's formula make? From web/:
//
//   npx tsx scripts/njs-calls.ts <Block> [<NamedBlock>] [<n>]
//
// Reads the live N.js (scripts/updater/.cache/N.new.js) and prints the calls inside
// `_customBlock_<Block>`; with <NamedBlock>, only inside its `if("<NamedBlock>"==d)` block;
// with <n> too, only inside that block's `<n>==b` branch. E.g. `Sailing ArtifactBonus 25` is
// the Artifact 25 formula. Compare with what ours calls via callDiff (lib/diagnose/njsCalls).
// A name used by several blocks of the function (TotalStats has 6 calcEtcBonuses) reads all of them.
// A call with no argument shown has a first argument that is not a literal.

import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { callKey, njsCalls, njsFunction, njsNamedBlocks, njsNumericBranch } from "@/lib/diagnose/njsCalls";
import { normalizeBundle } from "@/scripts/updater/extract";

const NJS = "scripts/updater/.cache/N.new.js"; // relative to web/, the cwd of `npx tsx`
const USAGE = "usage: npx tsx scripts/njs-calls.ts <Block> [<NamedBlock>] [<n>]   (e.g. Sailing ArtifactBonus 25)";

function main(argv: string[]) {
  const [block, ...selectors] = argv;
  if (!block || selectors.length > 2) throw new Error(USAGE);
  if (!existsSync(NJS)) throw new Error(`${NJS} not found (npx tsx scripts/updater/run.ts downloads it)`);

  const fn = njsFunction(normalizeBundle(readFileSync(NJS, "utf8")), block);
  if (!fn) throw new Error(`no _customBlock_${block} in the live N.js`);
  let text: string | undefined = fn.body;
  let path = block;
  for (const s of selectors) {
    path += ` > ${s}`;
    if (/^\d+$/.test(s)) {
      text = njsNumericBranch(text, Number(s), fn.params);
      if (text === undefined) throw new Error(`${path}: not found (the function takes (${fn.params.join(",")}))`);
    } else {
      const blocks = njsNamedBlocks(text, s);
      if (!blocks.length) throw new Error(`${path}: not found`);
      if (blocks.length > 1) console.log(`${blocks.length} blocks named ${s} (joined)`);
      text = blocks.join("\n");
    }
  }

  const calls = njsCalls(text);
  const count = new Map<string, number>();
  for (const c of calls) count.set(callKey(c), (count.get(callKey(c)) ?? 0) + 1);
  console.log(`${path}: ${calls.length} call sites, ${count.size} distinct, ${text.length} chars`);
  for (const [k, n] of count) console.log(`  ${k}${n > 1 ? `  x${n}` : ""}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
