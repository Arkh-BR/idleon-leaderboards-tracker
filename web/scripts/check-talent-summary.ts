// Sanity check the headline summary extraction (Current vs Max Effective LV)
// for Tal 12 across all chars. Reproduces what TalentsLevelPageClient
// renders so we catch findDescendant-style bugs before they hit the UI.

import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { numCharacters } from "../lib/corgan/save/data";
import { talent } from "../lib/corgan/stats/systems/common/talent";
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

function getChildByName(n: CorganNode, name: string): CorganNode | null {
  if (!n.children) return null;
  for (const c of n.children) if (c.name === name) return c;
  return null;
}

function findTargetEffectiveLevel(n: CorganNode): CorganNode | null {
  if (n.name === "Effective Level") return n;
  if (!n.children) return null;
  for (const c of n.children) {
    if (
      c.name === "Talent Cap (base + boosters)" ||
      c.name === "Max Book Lv Cap"
    )
      continue;
    const r = findTargetEffectiveLevel(c);
    if (r) return r;
  }
  return null;
}

console.log(
  "Talent 12 (BOOK_OF_THE_WISE) — Current Effective vs Max Effective per char\n"
);
console.log("Char | Invested | Cap  | Bonus | Super | Current | Max  | OK?");
console.log("-----|----------|------|-------|-------|---------|------|----");

for (let ci = 0; ci < numCharacters; ci++) {
  const ctx: any = {
    saveData,
    charIdx: ci,
    activeCharIdx: ci,
    splitSuperLevels: true,
  };
  const tree = talent.resolve(12, ctx);
  const effective = findTargetEffectiveLevel(tree);
  const baseLevel = effective ? getChildByName(effective, "Base Level") : null;
  const points = baseLevel ? Number(getChildByName(baseLevel, "Points Invested")?.val) || 0 : 0;
  const cap =
    baseLevel
      ? Number(
          (getChildByName(baseLevel, "Talent Cap (base + boosters)") ||
            getChildByName(baseLevel, "Max Book Lv Cap"))?.val
        ) || 0
      : 0;
  const bonus = effective
    ? Number(getChildByName(effective, "Bonus Levels")?.val) || 0
    : 0;
  const sup = effective
    ? Number(getChildByName(effective, "Super Levels")?.val) || 0
    : 0;
  const current = effective ? Number(effective.val) || 0 : points + bonus + sup;
  const max = cap + bonus + sup;
  const sane = max >= current;
  console.log(
    `${String(ci).padStart(4)} | ${String(points).padStart(8)} | ${String(cap).padStart(4)} | ${String(bonus).padStart(5)} | ${String(sup).padStart(5)} | ${String(current).padStart(7)} | ${String(max).padStart(4)} | ${sane ? "OK" : "BUG (max<current)"}`
  );
}
