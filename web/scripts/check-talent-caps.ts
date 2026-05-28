import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { skillLvMaxData, numCharacters } from "../lib/corgan/save/data";
import { talent } from "../lib/corgan/stats/systems/common/talent";
import { TALENT_CAP_BOOSTERS } from "../lib/corgan/stats/data/common/talent-cap-boosters";
import type { CorganNode } from "../lib/corgan/node";

const g = globalThis as any;
if (!g.window) g.window = g;

const raw = JSON.parse(
  readFileSync(
    "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
    "utf8"
  )
);
loadSaveData(raw);

// Walk the tree for a node with the given name.
function findNode(root: CorganNode, name: string): CorganNode | null {
  if (root.name === name) return root;
  for (const k of root.children || []) {
    const f = findNode(k, name);
    if (f) return f;
  }
  return null;
}

const targets = Object.keys(TALENT_CAP_BOOSTERS)
  .map(Number)
  .sort((a, b) => a - b);

console.log("Talent | Char | Computed Cap | Saved SM | Match");
console.log("-------|------|--------------|----------|------");

let total = 0;
let matches = 0;
let activeTotal = 0;
let activeMatches = 0;

for (const tid of targets) {
  for (let ci = 0; ci < numCharacters; ci++) {
    const ctx: any = {
      saveData,
      charIdx: ci,
      activeCharIdx: ci,
    };
    const tree = talent.resolve(tid, ctx);
    const capNode = findNode(tree, "Talent Cap (base + boosters)");
    const computed = Number(capNode?.val) || 0;
    const saved =
      Number(
        (skillLvMaxData as any)?.[ci]?.[tid] ??
          (skillLvMaxData as any)?.[ci]?.[String(tid)]
      ) || 0;
    const ok = computed === saved;
    const isActive = saved > 0;
    total++;
    if (ok) matches++;
    if (isActive) {
      activeTotal++;
      if (ok) activeMatches++;
    }
    const status = ok
      ? "OK"
      : isActive
        ? "MISMATCH (Δ=" + (computed - saved) + ")"
        : "(saved=0 — talent not active for this char)";
    console.log(
      `  ${String(tid).padStart(4)} | ${String(ci).padStart(4)} | ${String(computed).padStart(12)} | ${String(saved).padStart(8)} | ${status}`
    );
  }
  console.log("");
}

console.log(
  `\n=== Active chars (saved>0): ${activeMatches}/${activeTotal} (${((100 * activeMatches) / activeTotal).toFixed(1)}%) ===`
);
console.log(
  `=== All chars: ${matches}/${total} (${((100 * matches) / total).toFixed(1)}%) ===`
);
console.log(
  `=== Inactive chars (saved=0): expected — computed shows the "potential" cap (100) ===`
);
