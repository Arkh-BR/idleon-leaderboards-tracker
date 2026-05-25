// Final wire-up: load ARKHE, run computeCorganDropRate, print the
// Corgan-style tree side-by-side with the descriptor's combine() output.

import { readFileSync } from "node:fs";
import { computeCorganDropRate } from "../lib/corgan/computeDR";

const SAVE_PATH =
  process.argv[2] ||
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\data from suport ARKHE.json";

const charIdx = Number(process.argv[3] ?? 0);
const raw = JSON.parse(readFileSync(SAVE_PATH, "utf8"));
const { tree, total } = computeCorganDropRate(raw, charIdx, 0);

console.log(`[corgan-final] ${tree.name} → ${total.toFixed(4)}x\n`);

function printNode(n: any, depth = 0, max = 99) {
  if (depth > max) return;
  const indent = "  ".repeat(depth);
  const v =
    typeof n.val === "number"
      ? n.fmt === "x"
        ? n.val.toFixed(3) + "x"
        : n.fmt === "+"
          ? (n.val >= 0 ? "+" : "") + n.val.toFixed(3)
          : n.val.toFixed(3)
      : String(n.val);
  console.log(`${indent}${n.name.padEnd(30 - depth * 2)} ${v}` + (n.note ? `  (${n.note})` : ""));
  if (n.children && depth < max) {
    for (const c of n.children) printNode(c, depth + 1, max);
  }
}

printNode(tree, 0, 2);

console.log(
  "\n(Top 3 levels shown — sub-trees collapse to keep stdout readable.)"
);
