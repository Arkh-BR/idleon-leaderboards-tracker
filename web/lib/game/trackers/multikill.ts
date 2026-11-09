// The Multikill tracker: the page's { tree, total } for N.js WorkbenchStuff("MultiKillTOTAL") (the "MULTIKILL: X%" line of the AFK Info panel), built from the ONE traced call.
//
// The number is TRACKERS.multikill. The block is ⌊MultiKill_base + OverkillStuffs("2") × MultiKill_perTier⌋, so the tree is read out of the three calls it makes, as the other trackers read theirs
// (trackers/coinMulti.ts): each source of a half finds the call(s) it stands for among that half's direct calls and carries them as children (Ruling L, trackers/page.ts); the tier's rows come from
// what OverkillStuffs("2") read. The tree is not grouped: the halves with their rule rows, the tier, the status row (lib/multikill/layers). A half's value is the call's, so the tree shows B′ and P′ as the
// game has them. The names, formats and notes are lib/arkh's, which the page's Biggest Gains and the Observed Max data are keyed by.
//
// The tier's rows the block has no call for: the Target HP is the function the block used (monsterHPTotal), the static HP is game data, and the two thresholds are OverkillStuffs("0") and ("1") @4095677
// (HP at tier 1, else HP × E × E^(T-1); HP × E × E^T), which only the game's purple bar reads: two products here rather than two more ported sub-cases.
// The "Active in AFK" row is OverkillStuffs("3") and its gates, which MultiKillTOTAL does not call: they run on the root of the trace (so their `runtime:` / `assumed:` notes stay on the page) and each is
// guarded: a read that throws is a noted 0, never the page's error (the Drop Rate chip's rule, trackers/dropRate.ts). A map with no monster on its AFK target (33) is refused as the block refuses it.
//
// The recombination guard rebuilds the total from the tree with the page's own Biggest Gains model (multikillGainsModel): the total is a floored integer, so it must be exact, or TreeTotalMismatch makes the
// tracker read "incomplete". That also checks the soft cap the page's what-if uses (mkSoftCap) against the block's.
//
// The type of the result is the page's own (lib/statTracker/config StatResult: type-only).
import { flattenTree } from "@/lib/dropRate/treeFlatten";
import { multikillGainsModel } from "@/lib/multikill/gains";
import { MK_NODES, MK_POOLS, MK_ROOT, mkRuleRows, type MkParts } from "@/lib/multikill/layers";
import type { StatResult } from "@/lib/statTracker/config";
import { afkTarget } from "../afkTarget";
import { asNum, asNumber } from "../attr";
import { makeCtx, type Ctx, type TraceNode } from "../ctx";
import { MONSTERS } from "../data";
import { TreeTotalMismatch } from "../errors";
import { hString } from "../hstring";
import { PlayerAccTot } from "../njs/PlayerAccTot";
import { monsterDefence, monsterHPTotal, overkillExponent, RunCodeOfTypeXforThingY } from "../njs/RunCodeOfTypeXforThingY";
import { WorkbenchStuff } from "../njs/WorkbenchStuff";
import { findCall, flagged, migratedNote, stateOf, takeFrom, traceTree, type Take } from "./page";

type Node = StatResult["tree"];

/** What a source computes from: `t` takes a call its half made (it must exist), `leaf` shows a number that is no call of its own, `c` reads the save. */
type Ops = { t: Take; leaf: (name: string, val: number, note: string) => number; c: Ctx };
/** One source of a half: its name and note as lib/arkh's tree has them, and `of`, the term as the half adds it. */
type Source = { name: string | ((c: Ctx) => string); note?: string; of: (o: Ops) => number };

// Offsets (raw N.js): MultiKill_perTier @7805748, MultiKill_base @7808345, MultiKillTOTAL @7810403. The keys are MK_POOLS's ids.
const SOURCES: Record<string, Source> = {
  sign47: { name: "Cullingo (Star Sign 47)", note: "+15% Total Multikill, × Seraph", of: ({ t }) => t("DNSM.StarSigns", "MultiKill") },
  saltLick8: { name: "Multikill Rate (Salt Lick 8)", note: "3 per level, max 10", of: ({ t }) => t("SaltLick", 8) },
  stampC19: { name: "Multikill Stamp (Stamp C19)", note: 'StampBonusOfTypeX("Overkill"); only C19 has that type', of: ({ t }) => t("StampBonusOfTypeX", "Overkill") },
  deathNoteBuilding: { name: "Death Note building", note: "2 × the building level (TowerInfo[2])", of: ({ leaf, c }) => 2 * leaf("TowerInfo[2]", asNum(c, "TowerInfo", 2), "Building level") },
  etc29: { name: "Multikill (Equipment)", note: "EtcBonuses(29) = %_MULTIKILL", of: ({ t }) => t("EtcBonuses", "29") },
  ach148: { name: "Too Cute To Live (Achievement 148)", of: ({ t }) => Math.min(5, t("AchieveStatus", 148)) },
  ach122: { name: "Wazzzzam! (Achievement 122)", note: "× 6", of: ({ t }) => 6 * t("AchieveStatus", 122) },
  ach123: { name: "Just Passing By (Achievement 123)", note: "× 2", of: ({ t }) => 2 * t("AchieveStatus", 123) },
  talent654: { name: "Monolithialism (Talent 654)", of: ({ t }) => t("ArbitraryCode", "StatueOnyxOwned") * t("GetTalentNumber", 1, 654) },
  // the name carries the map's world, so Biggest Gains and Compare only meet the map-251 reference (W6) on a W6 map (spec M11)
  deathNoteWorld: { name: (c) => `Death Note (W${Math.floor(c.map / 50) + 1} page)`, of: ({ t, c }) => t("WorkbenchStuff", "OverkillQTY", Math.floor(c.map / 50), 0) },
  deathNoteMini: { name: "Death Note (minibosses)", of: ({ t }) => t("WorkbenchStuff", "OverkillQTY", 7, 0) },
  vialOverkill: { name: "Slowergy Drink (Vial 35)", note: "Vial effect key Overkill", of: ({ t }) => t("DNSM.AlchVials", "Overkill") },
  buff46: { name: "Void Radius (Talent 46)", note: "active buff only", of: ({ t }) => t("GetBuffBonuses", 46, 2) },
  talent58: { name: "Master Of The System (Talent 58)", of: ({ t, c }) => t("getbonus2", 1, 58, -1) * Math.floor(asNum(c, "OptionsListAccount", 158) / 5) },
  arcade8: { name: "Multikill Per Tier Arcade Bonus (Arcade 8)", of: ({ t }) => t("ArcadeBonus", 8) },
  artifact26: { name: "Trilobite Rock (Artifact 26)", of: ({ t }) => t("Sailing", "ArtifactBonus", 26, 0) },
  buff469: { name: "Mana Is Life (Talent 469)", note: "active buff only", of: ({ t }) => t("GetBuffBonuses", 469, 2) },
  chipMkill: { name: "Wood Chip (Lab Chip 14)", note: "Chip effect key mkill; only the active character's chips", of: ({ t }) => t("chipBonuses", "mkill") },
  etc71: { name: "Multikill per Tier (Equipment)", note: "EtcBonuses(71) = %_MULTIKILL_PER_TIER", of: ({ t }) => t("EtcBonuses", "71") },
  meas9: { name: "Multikill per Tier Measurement (Measurement 9)", note: "Base × the Gloomie-kills multi (type 0)", of: ({ t }) => t("Holes", "MeasurementBonusTOTAL", 9, 0) },
  card80: { name: "Multikill per Tier Cards (Card Type 80)", of: ({ t }) => t("CardBonusREAL", 80) },
  sign78: { name: "Killian Maximus (Star Sign 78)", note: "+3% Multikill per Tier, × Seraph", of: ({ t }) => t("DNSM.StarSigns", "78") },
  prayer16: { name: "Balance Of Pain (Prayer 16)", of: ({ t }) => t("prayersReal", 16, 0) },
  shiny4: { name: "Multikill Per Tier Shiny Pet (Breeding 4)", of: ({ t }) => t("Breeding", "ShinyBonusS", "Nah", 4, -1) },
  box13b: { name: "Utilitarian Capsule (Post Office 13b)", note: "% Multikill per Tier (second slot of box 13)", of: ({ t }) => t("DNSM.BoxRewards", "13b") },
  bubbleMKtier: { name: "Mr Massacre (Kazam Cauldron)", note: 'ACTIVE bubble (key MKtierACTIVE): counts only with Sheepie or when "c15" is equipped', of: ({ t }) => t("DNSM.AlchBubbles", "MKtierACTIVE") },
  cardSet11: { name: "Multikill Per Tier Set Bonus (Card Set 11)", of: ({ t }) => t("CardSetBonuses", 0, "11") },
};

const CURSES = [
  [0, "Curse: Big Brain Time (Prayer 0)"],
  [7, "Curse: Midas Minded (Prayer 7)"],
  [8, "Curse: Jawbreaker (Prayer 8)"],
] as const;

const raw = (name: string, val: number, note?: string, children?: Node[]): Node => ({ name, val, fmt: "raw", ...(note ? { note } : {}), ...(children?.length ? { children } : {}) });
const sum = (items: Node[]) => items.reduce((a, i) => a + i.val, 0);

/**
 * The page's result for the character and map of a traced Ctx (nothing computed on it yet): runs `WorkbenchStuff("MultiKillTOTAL")` once, then reads the tree out of the calls it made.
 * A save the game would not have the keys for (Ruling E) throws what the engine throws (MissingSaveKey...).
 */
export function multikillTree(ctx: Ctx): StatResult {
  if (!ctx.trace) throw new Error("Multikill: the tree is read from the trace, and this Ctx has none");
  const total = WorkbenchStuff(ctx, "MultiKillTOTAL", 0, 0); // the one call (TRACKERS.multikill, trackers/index.ts)
  const root = ctx.trace;
  const call = root.children.find((n) => n.block === "WorkbenchStuff" && "MultiKillTOTAL" === n.args[0] && "cached" !== n.note);
  if (!call) throw new Error('Multikill: no WorkbenchStuff("MultiKillTOTAL") call in the trace');
  const direct = (block: string, ...args: (string | number)[]): TraceNode => {
    const n = findCall(call, block, args);
    if (!n) throw new Error(`Multikill: MultiKillTOTAL made no ${block}(${args.map((a) => JSON.stringify(a)).join(", ")}) call`);
    return n;
  };
  const baseCall = direct("WorkbenchStuff", "MultiKill_base", 0, 0);
  const tierCall = direct("RunCodeOfTypeXforThingY", "OverkillStuffs", "2");
  const perTierCall = direct("WorkbenchStuff", "MultiKill_perTier", 0, 0);
  const plain: Ctx = { ...ctx, trace: null }; // the adapter's own save reads leave nothing in the trace
  const used = new Set<TraceNode>();

  const source = (from: TraceNode, id: string): Node => {
    const def = SOURCES[id];
    if (!def) throw new Error(`Multikill: no source "${id}" in the adapter`);
    const kept: Node[] = [];
    const t = takeFrom(from, used, kept, `Multikill: ${from.args[0]}`, id);
    const leaf = (name: string, val: number, note: string) => (kept.push(raw(name, val, note)), val);
    const val = def.of({ t, leaf, c: plain });
    return { name: typeof def.name === "function" ? def.name(plain) : def.name, val, fmt: "+", ...(def.note ? { note: def.note } : {}), ...(kept.length ? { children: kept } : {}) };
  };

  /** A row of the tier that is a call OverkillStuffs("2") made: its value, and the call as its child (Ruling L). */
  const tierRow = (name: string, note: string | undefined, block: string, ...args: (string | number)[]): Node => {
    const kept: Node[] = [];
    return raw(name, takeFrom(tierCall, used, kept, 'Multikill: OverkillStuffs("2")', name)(block, ...args), note, kept);
  };

  /** A read the block did not make: on the root of the trace, its calls' flagged notes kept under the row, and guarded (see the header). */
  const guarded = (name: string, read: (c: Ctx) => number, note?: string): Node => {
    const from = root.children.length;
    let val = 0;
    let why = note;
    try {
      val = read(ctx);
    } catch (e) {
      why = `not read: ${e instanceof Error ? e.message : String(e)}`;
    }
    const calls = root.children.slice(from);
    calls.forEach((n) => used.add(n));
    return raw(name, val, why, calls.filter(flagged).map(traceTree));
  };

  // ── the tier ──
  const target = afkTarget(plain);
  const mob = (MONSTERS as Record<string, Readonly<Record<string, unknown>>>)[target]; // the block refused a target the table does not have
  const hp = monsterHPTotal(plain);
  const E = overkillExponent(plain);
  const T = tierCall.value;
  const maxDamage = tierRow("Max Damage", undefined, "DamageDealed", "Max"); // the first of the loop's reads; the others are memo hits of it
  let hpRows: Node[];
  if (findCall(tierCall, "Thingies", ["Clamz_HP", 0, 0])) hpRows = [tierRow("Clamworks HP", "1e16 × 30^OLA[464]", "Thingies", "Clamz_HP", 0, 0)];
  else {
    const curses = CURSES.map(([d, name]) => tierRow(name, undefined, "prayersReal", d, 1));
    hpRows = [
      findCall(tierCall, "RiftStuff", ["mobHP", 0]) ? tierRow("Static HP", undefined, "RiftStuff", "mobHP", 0) : raw("Static HP", asNumber(mob.MonsterHPTotal)),
      { name: "Prayer curses", val: 1 + sum(curses) / 100, fmt: "x", children: curses },
    ];
  }
  const tier: Node = {
    name: 5 == E ? MK_NODES.tierW7 : MK_NODES.tier,
    val: T,
    fmt: "raw",
    note: `Map ${plain.map} · ${target}`,
    children: [maxDamage, raw("Target HP", hp, undefined, hpRows), raw("Exponent", E), raw("Tier reached at", 1 == T ? hp : hp * E * Math.pow(E, T - 1)), raw("Next tier at", hp * E * Math.pow(E, T))],
  };

  // ── the status row: the accuracy and the defence first, so OverkillStuffs("3") finds them read and their notes sit under their rows ──
  const accuracy = guarded("Accuracy", (c) => PlayerAccTot(c));
  const defence = guarded("Target Defence", (c) => monsterDefence(c));
  const on = guarded(MK_NODES.active, (c) => RunCodeOfTypeXforThingY(c, "OverkillStuffs", "3"));
  const type = hString(mob.AFKtype);
  const status: Node = {
    ...on,
    note: on.note ?? (1 != on.val ? "inactive: the game applies no multikill" : "FIGHTING" == type ? "the AFK Info shows the MULTIKILL line" : `the AFK Info hides the MULTIKILL line (${target} is ${type})`),
    children: [
      ...(on.children ?? []),
      raw("Max damage vs target HP", maxDamage.val >= hp * E ? 1 : 0, "maxDamage ≥ HP × E (E = the Exponent row)"),
      raw("Death Note built", 0.5 < asNum(plain, "TowerInfo", 2) ? 1 : 0, "TowerInfo[2] > 0.5"),
      raw("Accuracy beats the target's Defence", accuracy.val > 1.5 * defence.val ? 1 : 0, "Accuracy > 1.5 × target Defence", [accuracy, defence]),
    ],
  };

  // ── the halves ──
  const base = MK_POOLS.base.map((id) => source(baseCall, id));
  const perTier = MK_POOLS.perTier.map((id) => source(perTierCall, id));
  const parts: MkParts = {
    base: sum(base),
    perTier: sum(perTier),
    tier: T,
    softCap: 300 <= plain.map,
    cove: findCall(baseCall, "Holes2", ["Cglunko_MKbase", 0, 0]) ? { base: baseCall.value, perTier: perTierCall.value } : null,
  };
  const half = (name: string, note: string, from: TraceNode, items: Node[], rawSum: number): Node => ({ name, val: from.value, fmt: "+", note, children: [...items, ...mkRuleRows(parts, rawSum, from.value)] });

  const migrated = migratedNote(ctx.state);
  const tree: Node = {
    name: MK_ROOT,
    val: total,
    fmt: "%",
    note: `⌊B′ + T × P′⌋${migrated ? ` · ${migrated}` : ""}`,
    children: [half(MK_NODES.base, "B′", baseCall, base, parts.base), tier, half(MK_NODES.perTier, "P′ (× Damage Tier)", perTierCall, perTier, parts.perTier), status],
  };
  // One path for the number (spec section 4): the page's Biggest Gains rebuilds the total from the tree's values.
  const rebuilt = multikillGainsModel.totalFromFlat(flattenTree(tree));
  if (rebuilt !== total) throw new TreeTotalMismatch(total, rebuilt);
  // The flagged reads no row took, listed under the root.
  const extras = [...baseCall.children, ...tierCall.children, ...perTierCall.children, ...root.children.filter((n) => n !== call)].filter((n) => !used.has(n) && flagged(n)).map(traceTree);
  if (extras.length) tree.children = [...tree.children!, ...extras];
  return { tree, total };
}

/** `computeArkhMultikill`'s counterpart: the envelope of a save, a character index and the map to compute on. */
export function computeGameMultikill(save: unknown, charIdx: number, mapIdx: number): StatResult {
  return multikillTree(makeCtx(stateOf(save), { player: charIdx, map: mapIdx, trace: true }));
}
