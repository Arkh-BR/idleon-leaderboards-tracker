import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { numCharacters, currentMapData, charClassData } from "../lib/corgan/save/data";
import {
  computeMaxDamage,
  computeOverkillTier,
} from "../lib/corgan/stats/systems/common/derived-damage";
import { talent } from "../lib/corgan/stats/systems/common/talent";

const g = globalThis as any;
if (!g.window) g.window = g;

const raw = JSON.parse(
  readFileSync(
    "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json",
    "utf8"
  )
);
loadSaveData(raw);

console.log("Char | Cls | Map | maxDmg          | mon HP        | exp | tier | tal643");
console.log("-----|-----|-----|-----------------|---------------|-----|------|-------");

let allFinite = true;
let anyTierOutOfRange = false;
let any643Nonzero = false;

for (let ci = 0; ci < numCharacters; ci++) {
  const ctx: any = { saveData, charIdx: ci, activeCharIdx: ci };
  const maxDmg = computeMaxDamage(ci, ctx);
  const ok = computeOverkillTier(ci, ctx);
  const t643 = talent.resolve(643, ctx);
  const t643val = Number(t643.val);

  if (!Number.isFinite(maxDmg) || !Number.isFinite(ok.tier) || !Number.isFinite(t643val))
    allFinite = false;
  if (ok.tier < 1 || ok.tier > 50) anyTierOutOfRange = true;
  if (t643val !== 0) any643Nonzero = true;

  const cls = Number((charClassData as any)[ci]) || 0;
  const map = Number((currentMapData as any)[ci]) || 0;
  console.log(
    `${String(ci).padStart(4)} | ${String(cls).padStart(3)} | ${String(map).padStart(3)} | ` +
      `${maxDmg.toExponential(6).padStart(15)} | ${ok.monsterHP.toExponential(4).padStart(13)} | ` +
      `${String(ok.exponent).padStart(3)} | ${String(ok.tier).padStart(4)} | ` +
      `${t643val.toFixed(2).padStart(6)}`
  );
}

console.log("");
for (const ci of [0, 1, 3]) {
  const t = talent.resolve(643, { saveData, charIdx: ci, activeCharIdx: ci } as any);
  console.log(`talent 643 note (char ${ci}): val=${Number(t.val).toFixed(2)} | "${t.note}"`);
}
console.log("");
console.log("All finite (maxDmg/tier/643):", allFinite);
console.log("Any tier out of [1,50]:", anyTierOutOfRange);
console.log("Any talent-643 nonzero:", any643Nonzero);
