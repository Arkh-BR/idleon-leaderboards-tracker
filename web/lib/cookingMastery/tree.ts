// Builds the full Cooking Mastery Exp/h decomposition as an ArkhNode tree —
// the same data shape the Drop Rate tree uses, so it renders with <ArkhTree>.
//
//   Cooking Mastery Exp/h (raw)
//   ├── Core — base × upgrade factors (raw)
//   │   ├── Base value (×2)
//   │   ├── <each upgrade> (×factor)  →  base · coefficient · Purple PTS
//   └── External multiplier (×)
//       ├── Research Grid / Zuperbit / Companion (×)
//       └── Vial + Arcade + Salt Lick (×)  →  the three additive %s
import { node, type ArkhNode } from "../arkh/node";
import {
  readMasteryInputs,
  sourceBase,
  expRateCore,
  externalExpMulti,
  MASTERY_COEF,
  MASTERY_RANK_REQ,
  EXP_UPGRADE_IDS,
  UPGRADE_NAMES,
  type MasteryInputs,
} from "../arkh/stats/systems/common/cookingMastery";
import type { SaveData } from "../arkh/state";

/** Compact magnitude for notes. */
function k(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}

/** Human description of base_b (the game-state quantity behind each upgrade). */
function baseNote(b: number, inp: MasteryInputs): string {
  switch (b) {
    case 0:
      return `log₁₀(${k(inp.ladles)} ladles)`;
    case 1:
      return `max(0, ${inp.totalCookingLv} total Cooking LV − 1000)`;
    case 2:
      return `max(0, Divorce Cake LV ${inp.divorceCakeLv} − 75)`;
    case 4:
      return `Σ ribbon ranks = ${inp.totalRibbonRanks}`;
    case 5:
      return `Mastery rank ${inp.rank} + 1`;
    default:
      return "";
  }
}

export function expRateTree(s: SaveData): ArkhNode {
  const inp = readMasteryInputs(s);
  const ext = externalExpMulti(s);
  const core = expRateCore(inp, inp.purple);
  const total = core * ext.val;

  // Core branch: base 2 × ∏ (1 + base·coef·pts/100) over the Exp/h upgrades.
  const coreChildren: ArkhNode[] = [node("Base value", 2, null, { fmt: "x" })];
  for (const b of EXP_UPGRADE_IDS) {
    const base = sourceBase(b, inp);
    const coef = MASTERY_COEF[b];
    const pts = inp.purple[b] || 0;
    const factor = 1 + (base * coef * pts) / 100;
    const locked = inp.rank < MASTERY_RANK_REQ[b];
    coreChildren.push(
      node(
        UPGRADE_NAMES[b],
        factor,
        [
          node("Base (game state)", base, null, { fmt: "raw", note: baseNote(b, inp) }),
          node("Coefficient", coef, null, { fmt: "raw" }),
          node("Purple PTS spent", pts, null, { fmt: "raw" }),
        ],
        {
          fmt: "x",
          note: locked
            ? `locked — needs rank ${MASTERY_RANK_REQ[b]}`
            : "1 + base × coef × pts / 100",
          defaultClosed: locked || pts === 0,
        },
      ),
    );
  }

  // External branch: Purple-independent multipliers (validated to 0.08%).
  const slSum = ext.vial7cm + ext.arcade69 + ext.saltLick10;
  const externalChildren: ArkhNode[] = [
    node("Research Grid K3 (#190)", 1 + ext.researchGrid190 / 100, null, {
      fmt: "x",
      note: ext.researchGrid190 ? `+${ext.researchGrid190.toFixed(1)}%` : "not owned",
    }),
    node("Zuperbit (#68)", 1 + (40 * ext.superBit68) / 100, null, {
      fmt: "x",
      note: ext.superBit68 ? "owned (+40%)" : "not owned",
    }),
    node("Companion 87 (rift1)", 1 + 2 * ext.comp87, null, {
      fmt: "x",
      note: ext.comp87 ? "owned (×3)" : "not owned",
    }),
    node(
      "Vial + Arcade + Salt Lick",
      1 + slSum / 100,
      [
        node("Canteen Read vial", ext.vial7cm, null, {
          fmt: "raw",
          note: "% Cook Mastery EXP",
        }),
        node("Arcade (#69)", ext.arcade69, null, { fmt: "raw" }),
        node("Salt Lick #10 (Refinery6)", ext.saltLick10, null, { fmt: "raw" }),
      ],
      { fmt: "x", note: "×(1 + sum of the three %/100)" },
    ),
  ];

  return node(
    "Cooking Mastery Exp/h",
    total,
    [
      node("Core — base × upgrade factors", core, coreChildren, { fmt: "raw" }),
      node("External multiplier", ext.val, externalChildren, { fmt: "x" }),
    ],
    { fmt: "raw", note: "per hour" },
  );
}
