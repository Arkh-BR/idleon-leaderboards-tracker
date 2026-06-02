import { readFileSync } from "node:fs";
import { computeArkhDropRate } from "../lib/arkh/computeDR";
import type { ArkhNode } from "../lib/arkh/node";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";

const save = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const r = computeArkhDropRate(save, 2, 0);

const patterns = [
  /Sigil/i,
  /Drop Rate Shiny|Shiny Pet/i,
  /^Tome/i,
  /^Grid /i,
  /^Dream/i,
  /Pommelion|Pommelyon/i,
  /^Emperor/i,
  /Bundle|Bun_/i,
  /Sushi 48|RoG Bonus/i,
];

function walk(n: ArkhNode, path: string[]) {
  for (const p of patterns) {
    if (p.test(n.name)) {
      console.log(
        n.name.padEnd(55),
        "→",
        Number(n.val).toFixed(2),
        "  @",
        path.slice(-2).join(" / ")
      );
      break;
    }
  }
  for (const c of n.children || []) walk(c, [...path, n.name]);
}
walk(r.tree, []);
