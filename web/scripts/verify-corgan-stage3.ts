// Smoke test for Stage 3: exercise every world-specific system the DR
// descriptor queries. Prints val + child count per resolve to confirm
// shape parity with corgan-source.

import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/corgan/save/loader";
import { saveData } from "../lib/corgan/state";
import { arcade } from "../lib/corgan/stats/systems/w2/arcade";
import { voting } from "../lib/corgan/stats/systems/w2/voting";
import { postOffice } from "../lib/corgan/stats/systems/w2/postOffice";
import { prayer } from "../lib/corgan/stats/systems/w3/prayer";
import { shrine } from "../lib/corgan/stats/systems/w3/construction";
import { setBonus } from "../lib/corgan/stats/systems/w3/setBonus";
import { dream, cloudBonusSys } from "../lib/corgan/stats/systems/w3/equinox";
import { tome } from "../lib/corgan/stats/systems/w4/tome";
import { shiny } from "../lib/corgan/stats/systems/w4/breeding";
import { owl } from "../lib/corgan/stats/systems/w1/owl";
import { holes } from "../lib/corgan/stats/systems/w5/hole";
import { pristine } from "../lib/corgan/stats/systems/w5/pristine";
import { farm } from "../lib/corgan/stats/systems/w6/farming";
import { emperor } from "../lib/corgan/stats/systems/w6/emperor";
import { legendPTS } from "../lib/corgan/stats/systems/w7/legend";
import { spelunkShop } from "../lib/corgan/stats/systems/w7/spelunking";
import { guild } from "../lib/corgan/stats/systems/common/guild";
import { vault } from "../lib/corgan/stats/systems/common/vault";
import { equipment } from "../lib/corgan/stats/systems/common/equipment";

const SAVE_PATH =
  process.argv[2] ||
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\data from suport ARKHE.json";

const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
loadSaveData(raw);
console.log(`[corgan-stage3] Loaded — ${saveData.charNames.length} chars\n`);

const ctx = { saveData, charIdx: 0, activeCharIdx: 0 };

function show(label: string, n: any) {
  const v = typeof n.val === "number" ? n.val.toFixed(3) : String(n.val);
  const fmt = n.fmt ? ` [${n.fmt}]` : "";
  const c = n.children && n.children.length ? ` (${n.children.length}c)` : "";
  console.log(`  ${label.padEnd(34)} ${v}${fmt}${c}`);
}

console.log("=== W1 ===");
show("Owl 4 (DR)", owl.resolve(4, ctx));

console.log("\n=== W2 ===");
show("Arcade 27 (DR)", arcade.resolve(27, ctx));
show("Voting 27 (DR)", voting.resolve(27, ctx));
show("PostOffice [11,0]", postOffice.resolve("11,0", ctx));

console.log("\n=== W3 ===");
show("Prayer 7 (Midas Minded)", prayer.resolve(7, ctx));
show("Shrine 4 (Crescent)", shrine.resolve(4, ctx));
show("Set Bonus efaunt", setBonus.resolve("efaunt", ctx));
show("Dream 10 (DR symbol)", dream.resolve(10, ctx));
show("Cloud 69 (challenge)", cloudBonusSys.resolve(69, ctx, [5]));

console.log("\n=== W4 ===");
show("Tome 2 (DR)", tome.resolve(2, ctx));
show("Tome 7 (DR multi)", tome.resolve(7, ctx));
show("Shiny 0 (DR shiny)", shiny.resolve(0, ctx));

console.log("\n=== W5 ===");
show("Holes upg46", holes.resolve("upg46", ctx));
show("Holes upg82", holes.resolve("upg82", ctx));
show("Holes meas15", holes.resolve("meas15", ctx));
show("Holes monument", holes.resolve("monument", ctx));
show("Pristine 3 (charm)", pristine.resolve(3, ctx));

console.log("\n=== W6 ===");
show("Farm rank9", farm.resolve("rank9", ctx));
show("Farm cropSC7", farm.resolve("cropSC7", ctx));
show("Farm exotic59", farm.resolve("exotic59", ctx));
show("Emperor 11 (DR)", emperor.resolve(11, ctx));

console.log("\n=== W7 ===");
show("Legend PTS 1 (DR)", legendPTS.resolve(1, ctx));
show("SpelunkShop 50 (DR)", spelunkShop.resolve(50, ctx));

console.log("\n=== Common ===");
show("Guild 10 (DR)", guild.resolve(10, ctx));
show("Vault 18 (DR)", vault.resolve(18, ctx));
show("Equipment id=2 (DR)", equipment.resolve(2, ctx));
show("Equipment id=91 (DRmulti)", equipment.resolve(91, ctx));
show("Equipment id=99 (DRchance)", equipment.resolve(99, ctx));

console.log("\n[corgan-stage3] All systems resolved. Stage 3 OK.");
