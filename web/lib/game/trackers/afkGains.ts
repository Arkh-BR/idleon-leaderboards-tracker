// The AFK Gains tracker: the page's { tree, total } for N.js AFKgainrates("Fighting") (the AFK GAINS RATE line of the AFK Info panel), built from
// the ONE traced call.
//
// The number is `afkFightRate` below: AFKgainrates("Fighting") on the Ctx's map, times the page's A9 rule for the AFK target (a map whose target
// has nothing to fight is 0). The tree is read out of the trace, as the Damage tracker does (trackers/damage.ts): each source finds the call it
// stands for among AFKgainrates's direct calls (by block and arguments, each call once), takes its value and carries the call's own N.js trace
// as its child; a number AFKgainrates reads from the save itself (the W2 merit, the bun_u bundle) or fixes (the .4 base) is a leaf. The node
// names, formats and notes are display (lib/afkGains/layers.ts and the table below: the names lib/arkh's tree had, which the page's Biggest
// Gains and the Observed Max data are keyed by); a node's value is only what it shows, and the total never comes from the tree.
//
// The trace below a source is trimmed (Ruling L, trackers/page.ts). The reads that are no source but lead to a `runtime:` / `assumed:` note
// (a dungeon map's Dungon stand-in, Ruling Y, inside a talent) hang under the root, so the note stays visible.
//
// Decisions in force (the page's, kept from lib/arkh): A9 (spec 2026-09-24-afk-gains-page-design.md:53) a skill target shows the Fighting rate,
// and Nothing, Paying_Respect or a target with no definition gives 0; the Cove (map 216, cavern 17) counts as a fight whatever its target says;
// Ruling V, the AFK target follows ctx.map (lib/game/afkTarget.ts); Ruling Y, a dungeon map counts as outside a dungeon.
//
// Performance, measured when the page switched (a one-off perf script, since deleted; real saves, Node, median): lib/arkh 23 ms cold / 18 ms a character
// switch / 23 ms a map switch, lib/game 56 / 22 / 22 ms. A switch is at parity; the first call on a save (state build + Tome) costs about
// 33 ms more, once per save. Both are well under a perceptible delay (Ruling FF); lib/game pays for the trace its tree is read from.
//
// The type of the result is the page's own (lib/statTracker/config StatResult: type-only).
import type { StatResult } from "@/lib/statTracker/config";
import { AFK_NODES, AFK_POOLS, AFK_ROOT, afkRate } from "@/lib/afkGains/layers";
import { asNum, attr } from "../attr";
import { afkTarget } from "../afkTarget";
import { assumed, makeCtx, type Ctx, type TraceNode } from "../ctx";
import { MONSTERS } from "../data";
import { TreeTotalMismatch } from "../errors";
import { AFKgainrates } from "../njs/AFKgainrates";
import { bundleAsNum, haveBan } from "../njs/Thingies";
import type { GameState } from "../state";
import { flagged, migratedNote, near, stateOf, takeFrom, traceTree, type Take } from "./page";

type Node = StatResult["tree"];

/** The Cove: map 216 with the character in cavern 17 (Holes[0][character]), where its rate replaces everything (AFKgainrates @4448129). */
const inCove = (ctx: Ctx): boolean => 216 == ctx.map && 17 == attr(ctx, "Holes", 0, ctx.player);
const typeOf = (target: string): string | undefined => (MONSTERS as unknown as Record<string, { AFKtype?: string } | undefined>)[target]?.AFKtype;
/** The block name of the A9 trace leaf (it stands for no N.js function: `assumed()` leaves are no calls). */
const TARGET_LEAF = "AFK target";
const SKILL_NOTE = " — skill target: this page shows the fighting rate";

/**
 * The AFK page's rate: `AFKgainrates("Fighting")` on `ctx.map`, or 0 when the AFK target of that map has nothing to fight. This is page
 * product logic (decision A9 and the Cove override), not an N.js block. The game's AFK panel (@3803300) prints a literal 0% for a target whose
 * MonsterDefinitions AFKtype is "Nothing" or "Paying_Respect"; a target with no MonsterDefinitions entry (the maps whose default target is "Z"
 * or "Filler": no monster) has no panel at all. Those give 0 here. A skill target (MINING, CHOPPIN...) shows that skill's own rate in the game;
 * the page shows the Fighting rate there instead (A9), so it is not 0. The Cove counts as a fight whatever its target says (product decision).
 * The target is checked before the rate, so a map with nothing to fight computes nothing here.
 *
 * Both A9 branches leave an `assumed:` leaf in the trace (`AFK target`, value 0 or 1) so the page can say why; a plain fight leaves none.
 */
export function afkFightRate(ctx: Ctx): number {
  if (inCove(ctx)) return AFKgainrates(ctx, "Fighting");
  const target = afkTarget(ctx);
  const type = typeOf(target);
  if (undefined === type || "Nothing" == type || "Paying_Respect" == type) {
    assumed(
      ctx,
      TARGET_LEAF,
      undefined === type
        ? `${target} has no monster to fight: this page shows 0`
        : `the AFK target ${target}${type === target ? "" : ` (${type})`} has nothing to fight: this page shows 0`,
      0,
      `page decision A9 (docs/superpowers/specs/2026-09-24-afk-gains-page-design.md:53): map ${ctx.map}, target ${target}, AFKtype ${type ?? "no definition"}`
    );
    return 0;
  }
  if ("FIGHTING" != type)
    assumed(
      ctx,
      TARGET_LEAF,
      `the AFK target ${target} is a ${type} skill, whose own rate the game shows: this page shows the Fighting rate`,
      1,
      `page decision A9 (docs/superpowers/specs/2026-09-24-afk-gains-page-design.md:53): map ${ctx.map}, target ${target}, AFKtype ${type}`
    );
  return AFKgainrates(ctx, "Fighting");
}

/** What a source computes from: `t` takes a call, `leaf` shows a number that is no call of its own, `c` reads the save (no trace). */
type Ops = { t: Take; leaf: (name: string, val: number, note?: string) => number; c: Ctx };
/** One source of the tree: its name and note as lib/arkh's tree had them, and `of`, the term as AFKgainrates adds it (in percent). */
type Source = { name: string; note?: string; of: (o: Ops) => number };

const READ = "a plain read of the save, not an N.js call";
const gtn = (t: Take, n: number) => t("GetTalentNumber", 1, n);
const card = (t: Take, id: string) => t("RunCodeOfTypeXforThingY", "CardLv", id);

// Offsets: AFKgainrates @4443869 (the ALL terms @4444944, the MULTI factor @4445843, bun_u @4445985, the Fighting sum @4446123, map 306 @4447108, the Cove @4448129, the floor @4448512)
const SOURCES: Record<string, Source> = {
  // ── Fighting terms ──
  base: { name: "Base fighting rate (40%)", of: () => 40 }, // N.js adds the .4 outside Σ/100: shown as a 40% source
  fam8: { name: "Voidwalker Family Bonus", note: 'family bonus 4 (FamBonusQTYs["8"])', of: ({ t }) => t("DNSM.FamBonusQTYs", "8") },
  boxFightAFK: { name: "Post Office (fightAFK)", of: ({ t }) => t("DNSM.BoxRewards", "fightAFK") },
  talent88: { name: "Idle Brawling (Talent 88)", of: ({ t }) => gtn(t, 88) },
  bribe3: { name: "Sleeping on the Job (Bribe 3)", note: "+5% fighting AFK gains rate", of: ({ t }) => t("GetBribeBonus", "3") },
  talent268: { name: "Idle Shooting (Talent 268)", of: ({ t }) => gtn(t, 268) },
  cardSet10: { name: "Fight AFK Gain Rate Set Bonus (Card Set 10)", of: ({ t }) => t("CardSetBonuses", 0, "10") },
  talent448: { name: "Idle Casting (Talent 448)", of: ({ t }) => gtn(t, 448) },
  talent621: { name: "Tick Tock (Talent 621)", of: ({ t }) => gtn(t, 621) },
  card43: { name: "Fighting AFK Cards (Card Type 43)", of: ({ t }) => t("CardBonusREAL", 43) },
  talent79: { name: "Sleepin' On The Job (Talent 79)", of: ({ t }) => gtn(t, 79) },
  etc20: { name: "Fight AFK Gain (Equipment)", note: "EtcBonuses(20) = %_FIGHT_AFK_GAIN", of: ({ t }) => t("EtcBonuses", "20") },
  etc59: { name: "All AFK Gain (Equipment)", note: "EtcBonuses(59) = %_ALL_AFK_GAIN", of: ({ t }) => t("EtcBonuses", "59") },
  starFightAFK: {
    name: "Star Signs: Fighting AFK",
    note: "StarSigns.FightAFK: Silly Snoozer (19), The Forsaken (28), Mr No Sleep (29, negative), S. Snoozer Major (56)",
    of: ({ t }) => t("DNSM.StarSigns", "FightAFK"),
  },
  guild4: { name: "REM Fighting (Guild 4)", of: ({ t }) => t("GuildBonuses", 4) },
  prayer4: { name: "Zerg Rushogen (Prayer 4)", of: ({ t }) => t("prayersReal", 4, 0) },
  curse12: { name: "Ruck Sack curse (Prayer 12)", of: ({ t }) => -t("prayersReal", 12, 1) }, // N.js subtracts it: shown negative
  chipFafk: { name: "Conductive Software (Lab Chip 7)", note: "Chip effect key fafk; only the active character's chips", of: ({ t }) => t("chipBonuses", "fafk") },
  cardW6d1: { name: "Royal Egg (Card w6d1)", note: "Fighting AFK, passive (×1)", of: ({ t }) => card(t, "w6d1") },
  // ── ALL (every AFK type) ──
  // Tasks[2][1][2] > the character's index (GetPlayersUsernames.indexOf(UserInfo[0])): AFKgainzzALL = 2
  merit: {
    name: "Merit: AFK Gains for First Characters",
    note: "+2% AFK Gains for your first N characters (N = merit level, Tasks[2][1][2]); World 2 merit",
    of: ({ leaf, c }) => (leaf("Tasks[2][1][2]", asNum(c, "Tasks", 2, 1, 2), "Merit level") > c.player ? 2 : 0),
  },
  arcade6: { name: "AFK Gains Rate Arcade Bonus (Arcade 6)", of: ({ t }) => t("ArcadeBonus", 6) },
  compass57: { name: "Moon of Sleep (Compass 57)", of: ({ t }) => t("Windwalker", "CompassBonus", 57, 0) },
  voidSet: { name: "Void Set Bonus", note: 'Equipment set "void" (OLA[379] plus worn parts)', of: ({ t }) => t("GetSetBonus", "VOID_SET", "Bonus", 0, 0) },
  flurbo7: { name: "AFK Gains (Flurbo Shop 7)", of: ({ t }) => t("FlurboShop", 7) },
  divMajor: {
    name: "Snehebatu Major Bonus (Divinity 0)", note: "+30% AFK Gains while the active character is linked (×30)",
    of: ({ t, c }) => 30 * t("Divinity", "Bonus_MAJOR", c.player, 0),
  },
  divMinor5: { name: "AFK Gains (Divinity Minor Bonus 5)", note: "Σ over the linked gods' minor bonus, type 5", of: ({ t }) => t("Divinity", "Bonus_Minor", -1, 5) },
  comp6: { name: "Bored Bean (Companion 6)", of: ({ t }) => t("Companions", 6) },
  comp25: { name: "Axolotl (Companion 25)", of: ({ t }) => t("Companions", 25) },
  shrine8: { name: "Primordial Shrine (Shrine 8)", note: "active with Artifact 0, on its map, or in its world with Mainframe 5", of: ({ t }) => t("Shrine", 8) },
  talent650: { name: "Rando Event Looty (Talent 650)", of: ({ t }) => t("TalentCalc", 650) },
  winBonus11: { name: "AFK Gains (Winner Bonus 11)", note: "Summoning winner bonus 11", of: ({ t }) => t("Summoning", "WinBonus", 11, 0) },
  goldFoodAllAFK: {
    name: "Golden Dumpling (Golden Food)", note: "Σ of equipped + Emporium golden foods with effect AllAFK",
    of: ({ t }) => t("GoldFoodBonuses", "AllAFK"),
  },
  cardW6d3: { name: "Samurai Guardian (Card w6d3)", note: "All AFK, passive; × 1.5 per card level", of: ({ t }) => 1.5 * card(t, "w6d3") },
  roo5: {
    name: "Fisheroo Reset (Poppy Upgrade 5)", note: "Poppy the Kangaroo Mouse upgrade (code name RooBonuses 5), coefficient 0.5",
    of: ({ t }) => t("Summoning", "RooBonuses", 5, 0),
  },
  vote6: { name: "AFK Gains (Weekly Vote 6)", note: "Only counts the week vote 6 wins", of: ({ t }) => t("Summoning", "VotingBonusz", 6, 0) },
  eventShop5: { name: "Sleepy Joe Armstrong (Event Shop 5)", note: "×20: +20% AFK gains", of: ({ t }) => 20 * t("Summoning", "EventShopOwned", 5, 0) },
  vault23: { name: "Sleepy Time (Vault 23)", of: ({ t }) => t("Summoning", "VaultUpgBonus", 23, 0) },
  // `1 == BundlesReceived.bun_u` puts 30 in ALL; an absent BundlesReceived is the loader's empty map (Ruling H)
  bunU: {
    name: "AFK Bundle", note: "bun_u: clothes pack, +30% AFK gains; no in-game title",
    of: ({ leaf, c }) => 30 * leaf("BundlesReceived.bun_u", haveBan(c, "bun_u"), "Owned"),
  },
  // ── MULTI ──
  arcaneMapAfk: { name: "Arcane Map Bonus: AFK Gains", note: "MapBon slot 2 kills", of: ({ t }) => t("ArcaneType", "ArcaneMapMulti_bon", 2, 0) },
  etc92: { name: "AFK Gains Multi (Equipment)", note: "EtcBonuses(92) = %_AFK_GAINS_MULTI", of: ({ t }) => t("EtcBonuses", "92") },
};

// the ids of the pools, in N.js order: lib/afkGains/layers.ts has the one list (as damage.ts reads DMG_LAYERS)
const FIGHT_IDS = AFK_POOLS[0].sources;
const ALL_IDS = AFK_POOLS[1].sources;

/**
 * The page's result for the character and map of a traced Ctx (nothing computed on it yet): runs `afkFightRate` once, then reads the tree out
 * of the AFKgainrates call it made. A save the game would not have the keys for (Ruling E) throws what the engine throws (MissingSaveKey...).
 * A map whose AFK target has nothing to fight is 0 and its tree is the A9 leaf alone (Ruling DD): AFKgainrates is not called.
 */
export function afkTree(ctx: Ctx): StatResult {
  if (!ctx.trace) throw new Error("AFK Gains: the tree is read from the trace, and this Ctx has none");
  const state = ctx.state;
  const total = afkFightRate(ctx);
  const root = ctx.trace;
  const targetLeaf = root.children.find((n) => TARGET_LEAF === n.block);
  // Ruling DD: a target with nothing to fight is the game's literal "0%" (the AFK Info panel never calls AFKgainrates, @3803934): the tree is
  // the A9 leaf alone under the type node (as Damage's arena-only tree, Ruling Z), total 0, no source rows. afkRate over it (type 0) gives 0.
  if (targetLeaf && 0 === targetLeaf.value) {
    const target = afkTarget(ctx);
    const migrated = migratedNote(state);
    return {
      tree: {
        name: AFK_ROOT,
        val: 0,
        fmt: "x",
        note: `max(1%, ·)${migrated ? ` · ${migrated}` : ""}`,
        children: [{ name: AFK_NODES.type, val: 0, fmt: "x", note: `Map ${ctx.map} · ${target} · ${typeOf(target) ?? "no definition"}`, children: [traceTree(targetLeaf)] }],
      },
      total: 0,
    };
  }
  const call = root.children.find((n) => n.block === "AFKgainrates" && "cached" !== n.note);
  if (!call) throw new Error('AFK Gains: no AFKgainrates("Fighting") call in the trace');
  const plain: Ctx = { ...ctx, trace: null }; // the adapter's own save reads leave nothing in the trace
  const used = new Set<TraceNode>();

  const source = (id: string): Node => {
    const def = SOURCES[id];
    const kept: Node[] = [];
    const t = takeFrom(call, used, kept, "AFK Gains: AFKgainrates", id);
    const leaf = (name: string, val: number, note = READ) => (kept.push({ name, val, fmt: "raw", note }), val);
    const val = def.of({ t, leaf, c: plain });
    return { name: def.name, val, fmt: "+", ...(def.note ? { note: def.note } : {}), ...(kept.length ? { children: kept } : {}) };
  };

  const pool = [...FIGHT_IDS, ...ALL_IDS].map(source);
  const arcane = source("arcaneMapAfk");
  const etc92 = source("etc92");
  const cove = inCove(plain);
  const holes2 = cove ? call.children.find((n) => n.block === "Holes2") : undefined;
  if (cove && !holes2) throw new Error('AFK Gains: the Cove is active and AFKgainrates made no Holes2("Cglunko_AFKgains") call');
  if (holes2) used.add(holes2);
  const bun = cove ? Math.min(1, bundleAsNum(plain, "bun_u")) : 0;
  const target = afkTarget(plain);
  const type = cove ? "FIGHTING" : String(typeOf(target) ?? "no definition");
  const parts = {
    sum: pool.reduce((a, n) => a + n.val, 0),
    arcane: arcane.val,
    etc92: etc92.val,
    clam: 306 == ctx.map ? 0.2 : 1,
    cove: holes2 ? holes2.value * (1 + (30 * bun) / 100) : 0,
    type: targetLeaf ? targetLeaf.value : 1,
  };

  // One path for the number (spec section 4): the page's Biggest Gains rebuilds the total from these values. If the sources no longer give
  // the call's total (an N.js constant changed in one place only), there is no honest tree to show: throw, so the tracker reads "incomplete".
  const rebuilt = afkRate(parts);
  if (!near(rebuilt, total)) throw new TreeTotalMismatch(total, rebuilt);

  // reads that are no source but lead to a runtime: / assumed: note stay visible, like the A9 leaf (kept under the type node)
  const extras = [...call.children, ...root.children.filter((n) => n !== call && n !== targetLeaf)].filter((n) => !used.has(n) && flagged(n)).map(traceTree);
  const migrated = migratedNote(state);
  return {
    tree: {
      name: AFK_ROOT,
      val: total,
      fmt: "x",
      note: `max(1%, ·)${migrated ? ` · ${migrated}` : ""}`,
      children: [
        { name: AFK_NODES.pool, val: parts.sum / 100, fmt: "x", note: "Σ/100", children: pool },
        { name: AFK_NODES.arcane, val: 1 + parts.arcane / 100, fmt: "x", note: "× (1 + Σ/100) · MapBon slot 2", children: [arcane] },
        { name: AFK_NODES.etc92, val: 1 + parts.etc92 / 100, fmt: "x", note: "× (1 + Σ/100)", children: [etc92] },
        {
          name: AFK_NODES.clam,
          val: parts.clam,
          fmt: "x",
          note: `×0.2 on map 306 · ${306 == ctx.map ? "Clamworks: AFK gains are 1/5" : `map ${ctx.map}: no effect`}`,
        },
        {
          name: AFK_NODES.cove,
          val: parts.cove,
          fmt: "x",
          note: `Map 216 (The Hole), cavern 17 (The Cove); replaces the whole rate${cove ? "" : " · inactive: not map 216 in cavern 17"}`,
          // the cavern is read only on map 216 (as AFKgainrates does): any other map has nothing to show
          ...(cove && holes2
            ? {
                children: [
                  { name: "The character's cavern", val: asNum(plain, "Holes", 0, plain.player), fmt: "raw" as const, note: "Holes[0][char]" },
                  traceTree(holes2),
                  { name: "AFK Bundle", val: bun, fmt: "raw" as const, note: "×(1 + 30% with the bundle)" },
                ],
              }
            : {}),
        },
        {
          name: AFK_NODES.type,
          val: parts.type,
          fmt: "x",
          note: `Map ${ctx.map} · ${cove ? "Crystal Glunko Cove" : target} · ${type}${!cove && parts.type && "FIGHTING" != type ? SKILL_NOTE : ""}`,
          ...(targetLeaf ? { children: [traceTree(targetLeaf)] } : {}),
        },
        ...extras,
      ],
    },
    total,
  };
}

/** `computeArkhAfkGains`'s counterpart on a built state: AFKgainrates("Fighting") once, with the trace on, and the tree read out of it. */
export const gameAfk = (state: GameState, charIdx: number, mapIdx: number): StatResult => afkTree(makeCtx(state, { player: charIdx, map: mapIdx, trace: true }));

/** `computeArkhAfkGains`'s counterpart: the envelope of a save, a character index and the map to compute on. */
export function computeGameAfkGains(save: unknown, charIdx: number, mapIdx: number): StatResult {
  return gameAfk(stateOf(save), charIdx, mapIdx);
}
