// Smoke test for Stage 2: load the ARKHE save into Corgan state, then
// invoke each of the 6 ported systems against char 0 (ARKHE) for IDs that
// the drop-rate descriptor actually queries. Prints val + first sub-tree
// child so we can sanity-check shape and magnitude.

import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { achievement } from "../lib/corgan/stats/systems/common/achievement";
import { companion, compMulti } from "../lib/corgan/stats/systems/common/companions";
import { card, cardSet, cardSingle } from "../lib/corgan/stats/systems/common/cards";
import { stamp } from "../lib/corgan/stats/systems/w1/stamp";
import { talent } from "../lib/corgan/stats/systems/common/talent";
import { goldenFood } from "../lib/corgan/stats/systems/common/goldenFood";

const SAVE_PATH =
  process.argv[2] ||
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\data from suport ARKHE.json";

console.log(`[corgan-stage2] Loading ${SAVE_PATH}`);
const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
loadSaveData(raw);
console.log(`[corgan-stage2] Loaded — ${saveData.charNames.length} chars, ` +
  `${saveData.companionIds.size} companions\n`);

const ctx = { saveData, charIdx: 0, activeCharIdx: 0 };

function show(label: string, n: any) {
  const v = typeof n.val === "number" ? n.val.toFixed(3) : String(n.val);
  const fmt = n.fmt ? ` [${n.fmt}]` : "";
  const childInfo =
    n.children && n.children.length
      ? ` (${n.children.length} children)` : "";
  console.log(`  ${label.padEnd(28)} ${v}${fmt}${childInfo}  — ${n.name}`);
}

console.log("=== Talents (used by Drop Rate descriptor) ===");
show("Robbing Hood (279)", talent.resolve(279, ctx));
show("Curse Looty Booty (24)", talent.resolve(24, ctx));
show("Boss Battle Spill (655)", talent.resolve(655, ctx));
show("Archlord Pirates (328)", talent.resolve(328, ctx));

console.log("\n=== Stamps ===");
show("A38 (DR stamp)", stamp.resolve("A38", ctx));

console.log("\n=== Cards (Drop Rate type 10) ===");
show("Card type 10 (DR%)", card.resolve(10, ctx));
show("Card type 101 (DRx)", card.resolve(101, ctx));
show("Card Set 5 (Dmg/Drop/EXP)", cardSet.resolve(5, ctx));
show("Card Set 6 (Drop Rate)", cardSet.resolve(6, ctx));

console.log("\n=== Card Single (event cards) ===");
show("mini5a (1.5 per star)", cardSingle.resolve("mini5a", ctx, [1.5, 10]));
show("caveC (4 per star)", cardSingle.resolve("caveC", ctx, [4, 30]));

console.log("\n=== Achievements (DR-related) ===");
show("Achievement 377 (x6)", achievement.resolve(377, ctx, [6]));
show("Achievement 381 (x4)", achievement.resolve(381, ctx, [4]));

console.log("\n=== Companions ===");
show("Companion 3 (Crystal Custard)", companion.resolve(3, ctx));
show("Companion 50 (Santa Snake)", companion.resolve(50, ctx));
show("compMulti 26 (Mallay, cap 1.3)", compMulti.resolve(26, ctx, [1.3]));
show("compMulti 160 (Glunko, cap 1.5)", compMulti.resolve(160, ctx, [1.5, 2]));

console.log("\n=== Golden Food (DropRatez) ===");
show("Gold Food DropRatez", goldenFood.resolve("DropRatez", ctx));

console.log("\n[corgan-stage2] If every line above ran without throwing, Stage 2 OK.");
