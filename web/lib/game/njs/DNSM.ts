// DNSM is the game's cache of computed values. It is not in the save (Ruling A), so each cache the port
// reads is a function that replays the code that fills it. Only the caches Artifact Find reads from here;
// the other DNSM keys are ported where their function is (ShinyBonusS in Breeding, NghMrTOT in MenagerieStuff).
//
// DNSM convention (one rule, two shapes):
//  - a cache the game's formulas read BY KEY (`DNSM.StarSigns["61"]`, `DNSM.AlchVials["6turtle"]`, `DNSM.TomeQTYtot[n]`) is a per-key
//    `block("DNSM.<Name>", (ctx, key) => number)`: the trace shows each read and an unported key throws NotPorted;
//  - a cache whose only consumers are already per-id blocks (`Companions(ctx, id)` reads CompanionLVz/CompanionBon) may stay a plain
//    function that returns the Map, because the block that consumes it is what the trace shows.
import { asNum, asNumber, assumedLeaf, attr } from "../attr";
import { assumed, block, isTestCache, runtime, withPlayer, type Ctx } from "../ctx";
import { AlchemyDescription, CompanionDB, Number2Letter, PostOffUpgradeInfo, Tome } from "../data";
import { InvalidSaveValue, MissingSaveKey } from "../errors";
import { hString } from "../hstring";
import { contains, listAt, listOrMapAt } from "../lists";
import { charKey, opt, type GameState } from "../state";
import { traceNode, traceRoot, type TraceNode } from "../trace";
import { CauldronStats } from "./CauldronStats";
import { Companions } from "./Companions";
import { FamilyBonsuesREAL } from "./FamilyBonsuesREAL";
import { getLOG } from "./getLOG";
import { GetSetBonus } from "./GetSetBonus";
import { talentNumberDuringFamRebuild } from "./GetTalentNumber";
import { bestTalentDuringFamRebuild } from "./getbonus2";
import { PlayerHPmax } from "./PlayerHPmax";
import { PlayerMPmax } from "./PlayerMPmax";
import { PostOfficeINFO } from "./PostOfficeINFO";
import { ReturnClasses } from "./ReturnClasses";
import { Summoning } from "./Summoning";
import { StarSignsMap } from "./StarSigns";

/**
 * `u.getCompanionInfoMe()` @10650052: the account's companion list, one "id,x,x,x,stage2" entry each,
 * split on commas. It is not in the cloud save: the game asks the server at the map load. The envelope's
 * `companion.l` is a capture of that answer, which is the only copy of it a save has. A null envelope
 * companion is the game's own `null == list` fallback (an empty list), and shows in the trace as not counted.
 */
function companionEntries(ctx: Ctx): string[][] {
  const c = ctx.state.companion;
  if (c === null) {
    runtime(ctx, "getCompanionInfoMe", "envelope.companion is null: no companion list, so no owned companion");
    return [];
  }
  const l = typeof c === "object" ? (c as { l?: unknown }).l : undefined;
  if (l === undefined) throw new MissingSaveKey("envelope.companion.l");
  if (!Array.isArray(l)) throw new InvalidSaveValue("envelope.companion.l", "an array", l);
  return l.map((e) => hString(e).split(","));
}

/** DNSM.CompanionLVz @10650052: companion id (the entry's text before the first comma) -> the highest field 4 of its entries. */
const stage2Of = (entries: string[][]): Map<string, number> => {
  const lvz = new Map<string, number>();
  for (const p of entries) lvz.set(p[0], Math.max(asNumber(lvz.get(p[0])), asNumber(p[4])));
  return lvz;
};
export const DNSM_CompanionLVz = (ctx: Ctx): Map<string, number> => stage2Of(companionEntries(ctx));

/**
 * DNSM.CompanionBon @10650632: companion id -> its bonus. Owned companions (`f < CompanionDB.length`)
 * take CompanionDB[f][11] when their stage is exactly 1 (`1 == CompanionLVz[f]`), else [2]. Then every
 * Pet-Bonus Token in OptionsListAccount[606] (a comma list of ids) sets CompanionDB[id][2], over what
 * ownership gave: a token for a companion at stage 2 takes it back to the stage-1 value.
 *
 * With `CurrentMap == 41` (Pet Park) the game first drops from the token list, walking it from the end, every id that is owned
 * (`D.contains(GenINFO[167], c.asNumber(id))`) or one of "11 150 151 152 164 165 166" (@10651111), and writes the rest back to
 * OptionsListAccount[606] (the save is not written here: the state is immutable and this is the only reader of the list).
 */
export function DNSM_CompanionBon(ctx: Ctx): Map<string, number> {
  const entries = companionEntries(ctx);
  const lvz = stage2Of(entries);
  const owned = new Set(entries.map((p) => asNumber(p[0])));
  const bon = new Map<string, number>();
  for (let f = 0; f < CompanionDB.length; f++) {
    if (owned.has(f)) bon.set(`${f}`, asNumber(CompanionDB[f][lvz.get(`${f}`) == 1 ? 11 : 2]));
  }
  // OptionsListAccount[606] may be undefined (3 real saves): the game reads it as "null" (Std.string), a token id that sets the harmless key "null"
  let tokens = hString(attr(ctx, "OptionsListAccount", 606)).split(",");
  if (ctx.map == 41) {
    // @10651111: the splice loop, then the rebuild of the comma list ("" when nothing is left, which splits back to [""]: id 0's key "")
    const ownedIds = entries.map((p) => asNumber(p[0])); // GenINFO[167]
    const kept = tokens.filter((t) => !(contains(ownedIds, asNumber(t)) || contains("11 150 151 152 164 165 166".split(" "), t)));
    tokens = kept.join(",").split(",");
  }
  for (const id of tokens) {
    const row = CompanionDB[asNumber(id) | 0]; // NaN | 0 is 0
    // the game indexes CompanionDB[id][2] directly and would throw on an id past the list
    if (!row) throw new InvalidSaveValue("OptionsListAccount[606]", "ids of CompanionDB", id);
    bon.set(id, asNumber(row[2]));
  }
  return bon;
}

/**
 * `DNSM.StarSigns[key]`, the map `_customBlock_StarSigns` @6540624 rebuilds for the current player (StarSigns.ts, `StarSignsMap`): the
 * sum of what the active signs give that key, doubled by the Silkrode Nanochip and multiplied by Seraph Cosmos. A key no active sign
 * gives is absent from the map, which the game reads as 0 (`c.asNumber`). Sign 61 (Artifosho) gives "61" +15% Artifact Find chance.
 */
export const DNSM_StarSigns = block("DNSM.StarSigns", (ctx, key: string) => asNumber(StarSignsMap(ctx).get(key)));

/**
 * `DNSM.AlchVials[key]`, the map `TalentCalc(-2)` (@4482440) rebuilds at @4495601: a new map, then for each vial g of AlchemyDescription[4], under the vial's
 * kind AlchemyDescription[4][g][11], `CauldronStats("VialBonus", 4, g, 0)` added to what the kind already holds. `"6turtle"` is
 * Turtle Tisane (vial 74), the only vial of its kind. A kind no vial has is absent from the map, which the game reads as 0. Only the
 * vials of the kind asked are computed here; the others are other keys of the same loop.
 */
export const DNSM_AlchVials = block("DNSM.AlchVials", (ctx, key: string) => {
  let total: number | undefined;
  const vials = (AlchemyDescription as unknown as readonly (readonly unknown[])[][])[4];
  for (let g = 0; g < vials.length; g++) {
    if (hString(vials[g][11]) !== key) continue;
    total = CauldronStats(ctx, "VialBonus", 4, g, 0) + asNumber(total);
  }
  return asNumber(total);
});

/** The Tome score per state (per cache for a test's, isTestCache), then per character and map, with the notes of its trace. */
const tomeTotals = new WeakMap<GameState | Map<string, number>, Map<string, { total: number; notes: TraceNode[] } | "counting">>();

/** The `assumed:` and `runtime:` nodes of a trace, once each (by name and note), as leaves. */
function notesIn(node: TraceNode, out: TraceNode[] = []): TraceNode[] {
  for (const c of node.children) {
    if (/^(assumed|runtime): /.test(c.note ?? "") && !out.some((o) => o.block === c.block && o.note === c.note && String(o.args) === String(c.args))) {
      out.push({ ...c, children: [] });
    }
    notesIn(c, out);
  }
  return out;
}

const COUNTING =
  "the Tome actor's GenInfo[84], which _customEvent_TomeQTY's blocks read, is 0 until the event's first count ends (the actor's create pushes 0 @5778657 and runs the event 100 ms later @5779249)";

/** A test's cache for the count: it reads through to `parent` (its stubs and seeds) and keeps its own writes, so the count stays there. */
class Overlay extends Map<string, number> {
  /** The test's own cache under every overlay: the Tome's "counting" mark is kept there, so a read from inside the count sees it. */
  readonly root: Map<string, number>;
  constructor(private readonly parent: Map<string, number>) {
    super();
    this.root = parent instanceof Overlay ? parent.root : parent;
  }
  override get(key: string): number | undefined {
    return super.has(key) ? super.get(key) : this.parent.get(key);
  }
}

/**
 * `DNSM.TomeQTYtot`, the account's Tome score: `Summoning("TomePTS", g)` summed over every task of `DNSM.TomeQTY` (@5769465, at the end
 * of `_customEvent_TomeQTY`, and @5779131, the Tome actor's create, which keeps it as its `GenInfo[84]`). The game sums it once, at login,
 * for the character logged in, so the score here is the current character's count, on the save (TomeQTY.ts replays the event): a few
 * quantities are the character's own (its statues, star talents, inventory), and the totals of an account's characters differ by a few
 * points. Once per state, character and map. It stays an `assumed:` leaf (Ruling K): the game's number is session state, this one is the
 * save's.
 *
 * The sum runs on a trace of its own (124 tasks and the whole event would bury the tree that reads the score); what it assumed or
 * counted as 0 is hung under the score, with what the load steps assumed (the Tome reads the whole save).
 *
 * The quantities read blocks that read the score back (TotalTalentPoints, TomeQTY[15], reaches DNSM.AlchBubbles through the Divinity
 * minor bonus, and the map multiplies W8/A9/M9 by the score). In the game that read sees the Tome actor's GenInfo[84] as it is while the
 * event runs: 0 at login (the actor's create pushes 0 and runs the event 100 ms later, @5779249). So a read of the score while it is being
 * counted is 0, under an `assumed:` leaf. The count runs on a fresh cache (isTestCache): a value built on that 0 never reaches the
 * caller's cache, and what the caller seeded never reaches the score every Ctx of the state reads.
 */
export const DNSM_TomeQTYtot = block("DNSM.TomeQTYtot", (ctx) => {
  const test = isTestCache(ctx.cache);
  const owner = test ? (ctx.cache instanceof Overlay ? ctx.cache.root : ctx.cache) : ctx.state;
  let mine = tomeTotals.get(owner);
  if (!mine) tomeTotals.set(owner, (mine = new Map()));
  const key = `${ctx.player}|${ctx.map}`;
  let score = mine.get(key);
  if ("counting" === score) return assumed(ctx, "Tome.totalPoints", "Tome score read while the Tome is being counted: 0", 0, COUNTING);
  if (!score) {
    mine.set(key, "counting");
    try {
      const own = { ...ctx, trace: traceRoot(ctx.player), cache: test ? new Overlay(ctx.cache) : new Map<string, number>() };
      let total = 0;
      for (let g = 0; g < Tome.length; g++) total += Summoning(own, "TomePTS", g, 0); // DNSM.TomeQTY.length is Tome.length
      mine.set(key, (score = { total, notes: notesIn(own.trace) }));
    } catch (e) {
      mine.delete(key);
      throw e;
    }
  }
  const total = assumed(
    ctx,
    "Tome.totalPoints",
    "Tome score summed from the save the way the game does",
    score.total,
    'DNSM.TomeQTYtot = Σ Summoning("TomePTS", g) over DNSM.TomeQTY (@5769465, @5779131): the N.js sum, on _customEvent_TomeQTY replayed on the save (lib/game/njs/TomeQTY.ts); the game\'s own is session state, the Tome actor\'s GenInfo[84] (Ruling K)'
  );
  if (ctx.trace) {
    for (const n of score.notes) ctx.trace.children.push(traceNode(ctx.trace, ctx.player, n.block, n.args, n.value, n.note, n.detail));
    for (const a of ctx.state.assumed) assumedLeaf(ctx.trace, ctx.player, a); // a load step's, once (the Tome reads the whole save)
  }
  return total;
});

/**
 * `DNSM.FamBonusQTYs[key]`, the map `TalentCalc(-3)` @4496063 rebuilds: for every character (PlayerDATABASE, in character order; the
 * current one at its live Lv0[0] and class, the same numbers here), for each class on its way to its class (ReturnClasses) and each of
 * the class's two family bonuses A, the bonus at the character's level (FamilyBonsuesREAL) under the key 2 x class + A, when it beats
 * what the key holds. The current character's own entries are then times 1 + talent 144 / 100, and the keys 24 and 44 times
 * 1 + the best talent 144 of the account / 100 (getbonus2), both read with the map half built (key 68, the talent-level family bonus, is
 * what the loop has put there so far). A key no class gives is absent (0 to the readers).
 */
export const DNSM_FamBonusQTYs = block("DNSM.FamBonusQTYs", (ctx, key: string) => {
  const map = new Map<string, number>();
  const fam68 = () => asNumber(map.get("68"));
  for (let t = 0, n = ctx.state.charNames.length; t < n; t++) {
    const who = withPlayer(ctx, t);
    const level = asNum(who, "Lv0", 0); // DNSM.CalcTalentDN1
    const classes = ReturnClasses(asNum(who, "CharacterClass")); // DNSM.CalcTalentDL1
    for (let g = 0; g < classes.length; g++) {
      for (let A = 0; A < 2; A++) {
        const v = FamilyBonsuesREAL(ctx, asNumber(classes[g]), A, level); // DNSM.CalcTalentDN3
        const k = `${Math.round(2 * asNumber(classes[g]) + A)}`;
        if (!(v > asNumber(map.get(k)))) continue;
        map.set(k, v);
        // talent 144 is read before the `t == current` test, and each read goes through the "all talent levels", whose family bonus 68
        // is this map as built so far (the game rebuilds the cache in place, @4496122)
        const t144 = () => talentNumberDuringFamRebuild(ctx, 1, 144, fam68);
        if (0 < t144() && t == ctx.player) map.set(k, v * (1 + t144() / 100));
        if ("24" == k || "44" == k) map.set(k, v * (1 + bestTalentDuringFamRebuild(ctx, 1, 144, fam68) / 100));
      }
    }
  }
  return asNumber(map.get(key));
});

/**
 * `DNSM.BoxRewards[key]`, the map every `TalentCalc(d <= 0)` rebuilds @4481723: for each Post Office box f and each of its 3 bonuses A,
 * `PostOfficeINFO("BonusAmount", f, A)` added under the bonus's key PostOffUpgradeInfo[f][16 + A]. A key no box gives is absent (0).
 */
export const DNSM_BoxRewards = block("DNSM.BoxRewards", (ctx, key: string) => {
  let total: number | undefined;
  const boxes = PostOffUpgradeInfo as unknown as readonly (readonly unknown[])[];
  for (let f = 0; f < boxes.length; f++) {
    for (let A = 0; A < 3; A++) if (hString(boxes[f][16 + A]) === key) total = PostOfficeINFO(ctx, "BonusAmount", f, `${A}`) + asNumber(total);
  }
  return asNumber(total);
});

/**
 * `DNSM.AlchBubbles[key]`, the map `TalentCalc(-2)` @4482440 rebuilds for the current player, in this order:
 *  1. every bubble (AlchemyDescription[g][A], key [15]) that has a level (CauldronInfo[g][A] > 0) and is not an ACTIVE bubble, or is one
 *     the character has equipped (CauldronBubbles[player] holds Number2Letter[g] + A), or with Companion 4: `CauldronStats("BubbleBonus")`.
 *     Then, for a bubble that is not "passz", "ACTIVE" or "AllCharz", A below 30 and not 16, and a character past class 6: times the
 *     class's passz bubble (Opassz @4485032 for g = 0 and classes 7..17 but not Construction, Gpassz for g = 1 and 18..29, Ppassz for
 *     g = 2 and 30..41), as the map holds it at that point (a bubble before its passz bubble gets 1);
 *  2. @4486998 the five big bubbles of cauldrons 0..2 times MultiOr / MultiGr / MultiPu;
 *  3. MealSpdz @4488294 to the power of the meals at 11 or more; W2/A2/M2 and W4/A4/M4 times floor(cards / 100); W8/A9/M9 @4489669 times
 *     floor(max(0, Tome - 5000) / 2000) x (1 + (Grimoire 17 + the Troll set) / 100) and W10/A10/M10AllCharz times the same floor;
 *     W7/A8/M7 times max(1, floor((Lv0[0] - 500) / 10)); W9/A7/M8AllCharz @4493046 times 1 + 4 L / (L + 1000), L the levels of the
 *     account's warriors / archers / mages; the other trees' W1/A1/M1, W5/A5/M5, W6/A6/M6 set to 0 by class; Y6 @4495550 times the
 *     account's World 7 maps cleared (KillsLeft2Advance[251 + g][0] < 1, every character).
 * In step 1, MinEff is times getLOG(PlayerHPmax()) as it is set (@4483715) and ChopEff times getLOG(PlayerMPmax()) (@4484031); the other steps only
 * multiply them, so here the factor goes on the finished value. The game reads the HP and MP while the map is half rebuilt (the bubbles after these are
 * not in it yet): they are taken from the finished map, stated with `assumed()`.
 * Tome is the Tome actor's GenInfo[84], DNSM_TomeQTYtot (Ruling K).
 */
export const DNSM_AlchBubbles = block("DNSM.AlchBubbles", (ctx, key: string) => {
  const v = asNumber(alchBubbles(ctx).get(key));
  if (0 == v || ("MinEff" != key && "ChopEff" != key)) return v;
  const [what, max] = "MinEff" == key ? (["HP", PlayerHPmax] as const) : (["MP", PlayerMPmax] as const);
  const log = assumed(
    ctx,
    `getLOG(Player${what}max())`,
    `log10 of max ${what} after the stat rebuild (the game takes it mid-rebuild)`,
    getLOG(ctx, max(ctx)),
    `TalentCalc(-2) multiplies the ${key} bubble by getLOG(Player${what}max()) while it rebuilds DNSM.AlchBubbles (${"MinEff" == key ? "@4483715" : "@4484031"}), so the game's max ${what} misses the bubbles set after it; here it is the max ${what} of the finished map`
  );
  return v * log;
});

const BIG_BUBBLES = [
  [[0, 2, 4, 7, 14], "MultiOr"],
  [[0, 6, 9, 12, 14], "MultiGr"],
  [[0, 2, 6, 12, 14], "MultiPu"],
] as const;

function alchBubbles(ctx: Ctx): Map<string, number> {
  const desc = AlchemyDescription as unknown as readonly (readonly (readonly unknown[])[])[];
  const map = new Map<string, number>();
  const at = (k: string) => asNumber(map.get(k));
  const cls = asNum(ctx, "CharacterClass");
  for (let g = 0; g < 4; g++) {
    listOrMapAt(ctx, "CauldronInfo", g); // the game indexes CauldronInfo[g][A] directly
    for (let A = 0; A < desc[g].length; A++) {
      const k = hString(desc[g][A][15]); // DummyText
      const active = -1 != k.indexOf("ACTIVE");
      const on = 1 == Companions(ctx, 4) || (active && contains(attr(ctx, "CauldronBubbles", ctx.player), `${hString(Number2Letter[g])}${A}`)) || !active;
      if (!(on && 0 < asNum(ctx, "CauldronInfo", g, A))) continue;
      map.set(k, CauldronStats(ctx, "BubbleBonus", g, A, 0));
      if (-1 != k.indexOf("passz") || active || -1 != k.indexOf("AllCharz")) continue;
      if (6 < cls && 16 != A && 30 > A) {
        if (0 == g && 18 > cls && "Construction" != k) map.set(k, at(k) * Math.max(1, at("Opassz")));
        else if (1 == g && 30 > cls && 18 <= cls) map.set(k, at(k) * Math.max(1, at("Gpassz")));
        else if (2 == g && 42 > cls && 30 <= cls) map.set(k, at(k) * Math.max(1, at("Ppassz")));
      }
      if (3 == g) map.set(k, 1 * at(k));
    }
  }
  for (let g = 0; g < 3; g++) {
    const [which, multi] = BIG_BUBBLES[g];
    for (let A = 0; A < desc[g].length; A++) {
      if (!(which as readonly number[]).includes(A)) continue;
      const k = hString(desc[g][A][15]);
      map.set(k, at(k) * Math.max(1, at(multi)));
    }
  }
  let meals = 0;
  for (let f = 0, n = listAt(ctx, "Meals", 0).length; f < n; f++) if (11 <= asNum(ctx, "Meals", 0, f)) meals += 1;
  map.set("MealSpdz", Math.pow(at("MealSpdz"), meals));
  const cards = Math.floor(listAt(ctx, "Cards", 1).length / 100);
  for (let g = 0; g < 2; g++) for (const t of ["W", "A", "M"]) map.set(`${t}${Math.round(2 * (1 + g))}`, at(`${t}${Math.round(2 * (1 + g))}`) * cards);
  // ponytail: the Tome score only multiplies these six; when all are 0 (no level in them) every product is 0 whatever the score, so it is
  // not computed (an older save whose Tome cannot be scored is then not refused for a number that does not depend on it)
  const tomeKeys = ["W8", "A9", "M9", "W10AllCharz", "A10AllCharz", "M10AllCharz"];
  const tome = tomeKeys.some((k) => 0 != at(k)) ? Math.floor(Math.max(0, (DNSM_TomeQTYtot(ctx) - 5e3) / 2e3)) : 0;
  for (const k of ["W8", "A9", "M9"]) map.set(k, at(k) * tome * (1 + (Summoning(ctx, "GrimoireUpgBonus", 17, 0) + GetSetBonus(ctx, "TROLL_SET", "Bonus", 0, 0)) / 100));
  for (const k of ["W10AllCharz", "A10AllCharz", "M10AllCharz"]) map.set(k, at(k) * tome);
  const lvSteps = Math.max(1, Math.floor((asNum(ctx, "Lv0", 0) - 500) / 10));
  for (const k of ["W7", "A8", "M7"]) map.set(k, at(k) * lvSteps);
  let warriors = 0;
  let archers = 0;
  let mages = 0;
  for (let t = 0, n = ctx.state.charNames.length; t < n; t++) {
    const who = withPlayer(ctx, t);
    const c = asNum(who, "CharacterClass");
    if (6 > c) continue;
    if (18 > c) warriors += asNum(who, "Lv0", 0);
    else if (30 > c) archers += asNum(who, "Lv0", 0);
    else if (42 > c) mages += asNum(who, "Lv0", 0);
  }
  map.set("W9AllCharz", at("W9AllCharz") * (1 + (4 * warriors) / (warriors + 1e3)));
  map.set("A7AllCharz", at("A7AllCharz") * (1 + (4 * archers) / (archers + 1e3)));
  map.set("M8AllCharz", at("M8AllCharz") * (1 + (4 * mages) / (mages + 1e3)));
  const zero =
    7 > cls ? ["W1", "A1", "A5", "M5"] : 18 > cls ? ["A1", "A5", "A6", "M1", "M5", "M6"] : 30 > cls ? ["M1", "M5", "M6", "W1", "W5", "W6"] : ["W1", "W5", "W6", "A1", "A5", "A6"];
  for (const k of zero) map.set(k, 0);
  let cleared = 0;
  for (let t = 0, n = ctx.state.charNames.length; t < n; t++) {
    const who = withPlayer(ctx, t);
    for (let f = 0; f < 13; f++) if (1 > asNum(who, "KillsLeft2Advance", 251 + f, 0)) cleared += 1;
  }
  map.set("Y6", at("Y6") * cleared);
  return map;
}
