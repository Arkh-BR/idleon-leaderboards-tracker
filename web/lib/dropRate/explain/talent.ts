// The talent rows of the Drop Rate V1 tree, read from lib/game's blocks (no logic from lib/arkh: only the rows' names, order, formats and notes are V1's, as the page's snapshots and Compare are keyed by them).
//
// talentLevelRows is what every other family calls for a talent inside its own rows. A row the game's total does not depend on (the book cap, a bonus level) is read guarded: a save that cannot answer it gets a
// noted leaf, never a page error (Ruling PP, lib/game/trackers/dropRate.ts).
import { asNum, asNumber } from "@/lib/game/attr";
import { withPlayer, type Ctx } from "@/lib/game/ctx";
import { ArtifactInfo, ClassNames, DreamUpg, GodsInfo, LegendTalents, SaltLicks, SummonEnemies, TaskShopDesc, ZenithMarket } from "@/lib/game/data";
import { hString } from "@/lib/game/hstring";
import { listAt } from "@/lib/game/lists";
import { AchieveStatus } from "@/lib/game/njs/AchieveStatus";
import { ArcaneType } from "@/lib/game/njs/ArcaneType";
import { Companions } from "@/lib/game/njs/Companions";
import { Divinity } from "@/lib/game/njs/Divinity";
import { DNSM_AlchBubbles, DNSM_FamBonusQTYs } from "@/lib/game/njs/DNSM";
import { Dreamstuff } from "@/lib/game/njs/Dreamstuff";
import { FamilyBonsuesREAL } from "@/lib/game/njs/FamilyBonsuesREAL";
import { GamingStatType } from "@/lib/game/njs/GamingStatType";
import { getbonus2 } from "@/lib/game/njs/getbonus2";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { GetTalentNumber, talentCurveAt, talentCurves, talentNumberDuringFamRebuild } from "@/lib/game/njs/GetTalentNumber";
import { Ninja } from "@/lib/game/njs/Ninja";
import { ReturnClasses } from "@/lib/game/njs/ReturnClasses";
import { RoyalG } from "@/lib/game/njs/RoyalG";
import { allTalentLV, RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { Sailing } from "@/lib/game/njs/Sailing";
import { SaltLick } from "@/lib/game/njs/SaltLick";
import { Summoning, summWinBonus } from "@/lib/game/njs/Summoning";
import { Thingies } from "@/lib/game/njs/Thingies";
import { playerCount, skillLevel } from "@/lib/game/player";
import { charKey, opt } from "@/lib/game/state";
import type { ArkhNode, NodeFmt } from "../node";
import type { Explainer } from "./index";

export const row = (name: string, val: number, fmt?: NodeFmt, note?: string, children?: ArkhNode[]): ArkhNode => ({ name, val, ...(fmt ? { fmt } : {}), ...(note ? { note } : {}), ...(children?.length ? { children } : {}) });
export const raw = (name: string, val: number, note?: string, children?: ArkhNode[]): ArkhNode => row(name, val, "raw", note, children);
const cell = (list: unknown, ...at: number[]): unknown => at.reduce<unknown>((a, i) => (a as readonly unknown[])[i], list);

export const NOT_READ = "not read: ";
/** A row the save may not answer (see the header): a leaf saying why. `read` gives null for a row that does not exist right now. */
export function guarded(name: string, read: () => ArkhNode | null): ArkhNode | null {
  try {
    return read();
  } catch (e) {
    return { name, val: 0, note: `${NOT_READ}${e instanceof Error ? e.message : String(e)}` };
  }
}
/** The row only while `val` is above 0, as a talent's bonus levels are listed. */
export const when = (val: number, make: (v: number) => ArkhNode): ArkhNode | null => (0 < val ? make(val) : null);
export const present = (rows: (ArkhNode | null)[]): ArkhNode[] => rows.filter((r): r is ArkhNode => r !== null);

const ownerName = (c: Ctx, who: number): string => c.state.charNames[who] || `Char ${who}`;

/** `decay(40,65,268)`: a talent's first curve, at `level`. */
function curveNote(id: number, level: number): string {
  const [x1, x2, curve] = talentCurves(id);
  return `${hString(curve)}(${asNumber(x1)},${asNumber(x2)},${level})`;
}

// ===== The Max Book Lv Cap =====

const [SUMMON_NAMES, , , , , SUMMON_BUCKET, , SUMMON_VALUE, , RING_BUCKET, RING_VALUE] = SummonEnemies as unknown as readonly (readonly unknown[])[];

/** What the Endless rounds put in Winner Bonus `slot`, over the first `rounds` of them (the ring of 40, Summoning.ts summWinBonus). */
function ringOf(slot: number, rounds: number): number {
  let sum = 0;
  for (let i = 0; i < rounds; i++) if (slot == Math.round(asNumber(RING_BUCKET[i % 40]) - 1)) sum += asNumber(RING_VALUE[i % 40]);
  return sum;
}

const WORLD_COLOR: Record<number, string> = { 6: "Cyan", 7: "Teal" };

/**
 * The battles of Winner Bonus 19, per world: "Battle 14" is the 14th of its world in SummonEnemies. Every battle that gives the bonus is listed, beaten or not (Summon[1], the wins).
 * ponytail: no Endless row, the ring of 40 (SummonEnemies[9]) has no bucket 20 (bonus 19) today; the row's own number still counts one if an update adds it.
 */
function battleRows(c: Ctx): ArkhNode[] {
  const wins = new Map<unknown, number>();
  for (const name of listAt(c, "Summon", 1)) wins.set(name, (wins.get(name) ?? 0) + 1);
  const worlds = new Map<number, ArkhNode[]>(); // in SummonEnemies' order, which is the worlds' and each world's battles'
  const seen = new Map<number, number>();
  SUMMON_NAMES.forEach((mob, i) => {
    const world = /^w(\d+)[a-z]+\d+$/.exec(hString(mob));
    if (!world || "_" === SUMMON_BUCKET[i]) return;
    const w = Number(world[1]);
    const place = (seen.get(w) ?? 0) + 1;
    seen.set(w, place);
    const per = asNumber(SUMMON_VALUE[i]);
    if (19 != Math.round(asNumber(SUMMON_BUCKET[i]) - 1) || !(0 < per)) return;
    const kills = wins.get(mob) ?? 0;
    const value = 0 < kills ? kills * per * 3.5 : 0;
    const note = 0 < kills ? `${kills} kill × ${per} per kill × 3.5 base = ${value}` : `not yet defeated — would give ${per} × 3.5 = ${per * 3.5}`;
    worlds.set(w, [...(worlds.get(w) ?? []), raw(`Battle ${place}`, value, note)]);
  });
  return [...worlds].map(([w, battles]) => {
    const color = WORLD_COLOR[w] ?? `World ${w}`;
    return row(color, battles.reduce((a, b) => a + b.val, 0), "+", `Σ ${color} (W${w}) battles (post-Base Multi)`, battles);
  });
}

/** Winner Bonus 19's three factors, N.js `WinBonus` @10927394: the battles x 3.5, the charm and the gem shop, 1 + the boosts / 100. */
function winBonus19Kids(c: Ctx): ArkhNode[] {
  const rawWins = summWinBonus(c)[19];
  const pristine8 = Ninja(c, "PristineBon", 8, 0);
  const gem11 = asNum(c, "GemItemsPurchased", 11);
  const art32 = Sailing(c, "ArtifactBonus", 32, 0);
  const task = Math.min(10, asNum(c, "Tasks", 2, 5, 4));
  const ach379 = AchieveStatus(c, 379);
  const ach373 = AchieveStatus(c, 373);
  const godshard = GetSetBonus(c, "GODSHARD_SET", "Bonus", 0, 0);
  const banI = 50 * Thingies(c, "Have_ban_i", 0, 0);
  const pristineMult = 1 + pristine8 / 100;
  const gemMult = 1 + (10 * gem11) / 100;
  const higher = pristineMult * gemMult;
  const winnerMult = 1 + (art32 + task + ach379 + ach373 + godshard + banI) / 100;
  const battles = rawWins * 3.5;
  const total = Summoning(c, "WinBonus", 19, 0);
  return [
    raw("Summoning Battles", battles, `${rawWins} raw × 3.5× Base = ${battles.toFixed(2)}  →  then × ${higher.toFixed(2)}× Higher Bonus × ${winnerMult.toFixed(2)}× Winner = ${total.toFixed(2)}`, battleRows(c)),
    row("Higher Bonus Multi", higher, "x", "Pristine × Gem — the upgrade-lane multi", [
      row("Crystal Comb Pristine Charm", pristineMult, "x", "1 + lv/100", [raw("Pristine 8 Bonus", pristine8)]),
      row("Gem Shop Multi", gemMult, "x", "1 + 10×lv/100", [raw("Gem Items 11", gem11)]),
    ]),
    row("Winner Multi (combined)", winnerMult, "x", "1 + Σ winner sources / 100", [
      row("Sovereign Winz Lantern", art32, "+", undefined, [raw("Artifact 32 Base", asNumber(cell(ArtifactInfo, 32, 3))), raw("Artifact 32 Tier", asNum(c, "Sailing", 3, 32))]),
      row("W6 Merit Shop (Task)", task, "+"),
      row("Regalis Achievement (379)", ach379, "+"),
      row("Spectre Stars Achievement (373)", ach373, "+"),
      row("Godshard Set", godshard, "+"),
      ...(0 < banI ? [raw("Bundle ban_i", banI)] : []),
    ]),
  ];
}

/** `WorkbenchStuff("maxBookLv", 0, 0)` @7827446, every talent below 615's cap: round(125 + Artifact 21 + Winner Bonus 19 + 10 x min(Atoms[7], 1) + min(5, 5 x Achievement 145) + Salt Lick 4 + the merit shop's). `notes`: the Family Guy's copy says how each is made. */
function maxBookLvRow(c: Ctx, notes = false): ArkhNode {
  const say = (text: string) => (notes ? text : undefined);
  const salt = SaltLick(c, 4);
  const perPoint = asNumber(cell(TaskShopDesc, 2, 2, 11));
  const points = asNum(c, "Tasks", 2, 2, 2);
  const merit = perPoint * points;
  const ach145 = Math.min(5, Math.max(0, 5 * AchieveStatus(c, 145)));
  const atom = asNum(c, "Atoms", 7);
  const atomTen = 10 * Math.min(atom, 1);
  const relic = Sailing(c, "ArtifactBonus", 21, 0);
  const win19 = Summoning(c, "WinBonus", 19, 0);
  return raw("Max Book Lv Cap", Math.round(125 + relic + win19 + atomTen + ach145 + salt + merit), "N.js maxBookLv", [
    row("Base Level (N.js literal)", 100, "+"),
    row("Talent Book Library Base", 25, "+"),
    row("Salt Lick 4", salt, "+", say("Lv × Per Lv"), [raw("Salt Lick 4 Lv", asNum(c, "SaltLick", 4)), raw("Per Lv", asNumber(cell(SaltLicks, 4, 3)))]),
    row("W3 Merit Shop Unlock", merit, "+", say("Pts × Per Point"), [raw("W3 Merit Points Spent", points), raw("Per Point", perPoint)]),
    row("Checkout Takeout Achievement", ach145, "+"),
    row("Lv 1 Oxygen Atom", atomTen, "+", say("10 × min(Lv, 1)"), [raw("Atom 7 Lv", atom)]),
    row("Sovereign Fury Relic", relic, "+", say("Base × Tier"), [raw("Artifact 21 Base", asNumber(cell(ArtifactInfo, 21, 3))), raw("Artifact 21 Tier", asNum(c, "Sailing", 3, 21))]),
    row("Summoning Winner Bonus 19", win19, "+", say("Raw × Higher Bonus × Winner Multi"), winBonus19Kids(c)),
  ]);
}

/** The cap of every talent below 615 (`maxBookLvRow`'s value), for the star talents 641-647 and the scans that need only the number. */
export const maxBookLv = (c: Ctx): number => maxBookLvRow(c).val;

const cappedRow = (c: Ctx, notes?: boolean): ArkhNode => guarded("Max Book Lv Cap", () => maxBookLvRow(c, notes))!;
/** min(invested, cap); with no cap read there is nothing to apply. */
const capped = (level: number, cap: ArkhNode): number => (cap.note?.startsWith(NOT_READ) ? level : Math.min(level, cap.val));

/** `Base Level`: the talent's points, stopped at the cap. `reference`: the row that says whose they are, on a talent read as the best character's. `capRow`: the talent's own cap row, in place of the Max Book Lv Cap. */
function baseLevelRow(c: Ctx, level: number, who: number, reference?: string, capRow?: ArkhNode): ArkhNode {
  const name = ownerName(c, who);
  const cap = capRow ?? cappedRow(c);
  return raw("Base Level", capped(level, cap), `min(invested, cap) — owner: ${name}`, [
    ...(reference ? [raw(reference, level, "supplies the raw lv used as Points Invested AND the bonus levels (its own Symbols of Beyond, super-talent preset, Family Guy…) — N.js keeps the best player's whole chain")] : []),
    raw("Points Invested", level, `actual save — owner: ${name}`),
    cap,
  ]);
}

// ===== The bonus levels (N.js AllTalentLV @4085148) =====

/** Talent `id` is a super talent of `who`: on the current preset (`AllTalentLV`) or on either one (`AllTalentLVz`, getbonus2's read). */
function superListed(c: Ctx, id: number, who: number, anyPreset: boolean): boolean {
  const at = (i: number) => listAt(c, "Spelunk", Math.round(i)).indexOf(id);
  return 0 <= (anyPreset ? Math.max(at(20 + who), at(20 + who + 12)) : at(20 + who + 12 * asNum(c, "PlayerStuff", 1)));
}

function superTalentRow(c: Ctx, id: number, who: number, anyPreset: boolean, force = false): ArkhNode | null {
  if (!force && !superListed(c, id, who, anyPreset)) return null;
  return raw("Spelunk Super Talent", Thingies(c, "SuperTalentPTS_LVgiven", 0, 0), undefined, [
    raw("Base", 50),
    raw("Super Duper Talents (Yellow 2)", Thingies(c, "LegendPTS_bonus", 7, 0), "+10 super levels per level", [raw("Base", asNumber(cell(LegendTalents, 7, 2))), raw("Level", asNum(c, "Spelunk", 18, 7), "Zenith Market — Spelunk[18][7] (max 5)")]),
    raw("Zenith Super Dupers", Thingies(c, "ZenithMarketBonus", 5, 0), "+1 super level per level", [raw("Level", asNum(c, "Spelunk", 45, 5), "Zenith Market — Spelunk[45][5] (max 25)"), raw("Per Lv", asNumber(cell(ZenithMarket, 5, 4)))]),
  ]);
}

const SYMBOLS: Record<number, string> = { 149: "Symbols of Beyond ~R (Talent 149)", 374: "Symbols Of Beyond ~g (Talent 374)", 539: "Symbols Of Beyond ~p (Talent 539)" };

function symbolsRow(c: Ctx, talent: number): ArkhNode | null {
  const level = skillLevel(c, talent);
  return when(GetTalentNumber(c, 1, talent), (v) => raw(SYMBOLS[talent], v, curveNote(talent, level), [baseLevelRow(c, level, c.player)]));
}

/** `Family Guy Multi`: the character's talent 144 as a multiplier (N.js TalentCalc(-3) @4496063 reads it with the family bonus 68 at the value before the buff, DNSM_FamBonusQTYs). */
function familyGuyRow(c: Ctx, fam68: number): ArkhNode {
  const level = skillLevel(c, 144);
  const levels = allTalentLV(c, "AllTalentLV", "144", () => fam68);
  const sup = 0 < level && superListed(c, 144, c.player, false) ? Thingies(c, "SuperTalentPTS_LVgiven", 0, 0) : 0;
  const cap = cappedRow(c, true);
  return raw("Family Guy Multi (×) — potential buff", 1 + talentNumberDuringFamRebuild(c, 1, 144, () => fam68) / 100, "1 + decay(x1, x2, Base+Bonus)/100", [
    // V1 shows this what-if row with the cap as "Points Invested" and the save's points in the note
    raw("Base Level", capped(level, cap), "min(invested, cap)", [raw("Points Invested", cap.val, `save=${level}`), cap]),
    row("Bonus Levels", levels - sup, "+", "Σ ATL (unbuffed FB68, excl. super)"),
    ...(0 < sup ? [row("Super Levels", sup, "+", "Spelunk super talent (separated)")] : []),
  ]);
}

/** `Family Bonus 68`: floor(FamBonusQTYs["68"]). The walk is TalentCalc(-3)'s for this key (class 34, bonus 0), which says who holds it and whether their buff stuck: DNSM_FamBonusQTYs keeps only the number. */
function familyBonusRow(c: Ctx): ArkhNode | null {
  const val = Math.floor(DNSM_FamBonusQTYs(c, "68"));
  if (!(0 < val)) return null;
  const mages: ArkhNode[] = [];
  let held = 0;
  let unbuffed = 0;
  let holderLv = 0;
  let buffed = false;
  for (let t = 0, n = playerCount(c); t < n; t++) {
    const who = withPlayer(c, t);
    const cls = asNum(who, "CharacterClass");
    if (!ReturnClasses(cls).includes(34)) continue;
    const lv = asNum(who, "Lv0", 0);
    const v = FamilyBonsuesREAL(c, 34, 0, lv);
    if (!(0 < v)) continue;
    if (v > held) {
      const t144 = talentNumberDuringFamRebuild(c, 1, 144, () => v);
      buffed = 0 < t144 && t == c.player;
      held = buffed ? v * (1 + t144 / 100) : v;
      unbuffed = v;
      holderLv = lv;
    }
    mages.push(raw(`Char ${t} Lv`, lv, `${ownerName(c, t)} — ${hString(cell(ClassNames, cls)).replace(/_/g, " ").toLowerCase()} (cls ${cls})${t == c.player ? " — ACTIVE char (gets Family Guy buff if it wins the slot)" : ""}`));
  }
  return raw("Family Bonus 68 (Mage)", val, `floor(decay × Family Guy Multi if active)${buffed ? " — buffed by The Family Guy (Talent 144)" : ""}`, [
    raw("Best Mage Lv", holderLv, `max across account — ${mages.length} mage char${mages.length === 1 ? "" : "s"}`, mages),
    familyGuyRow(c, unbuffed),
  ]);
}

function divinityRow(c: Ctx): ArkhNode | null {
  return when(Math.ceil(Divinity(c, "Bonus_Minor", c.player, 2)), (v) =>
    raw("Divinity Minor 2 (Arctis)", v, undefined, [
      raw("Divinity Lv", asNum(c, "Lv0", 14)),
      raw("Bubble Y2 Active", DNSM_AlchBubbles(c, "Y2ACTIVE"), "0 unless BIG_P is equipped or Sheepie owned; Prisma included"),
      raw("Coral Kid 3", asNum(c, "OptionsListAccount", 430), "OLA[430]"),
      raw("God Minor X1(2)", asNumber(cell(GodsInfo, 2, 3)), "GodsInfo[2][3] constant"),
    ])
  );
}

/** Dream[12] is the level of DreamUpg[10]; the rows are its maximum, `UpgMaxLV` @10812361: DreamUpg[10][2] + Winner Bonus 24 + 10 x Super Bit 35 + 4 x Cloud 30. */
function equinoxRow(c: Ctx): ArkhNode | null {
  return when(asNum(c, "Dream", 12), (v) => {
    const win24 = Summoning(c, "WinBonus", 24, 0);
    const wins = asNum(c, "OptionsListAccount", 319);
    const endless = ringOf(24, wins);
    return raw("Equinox Symbols (Dream 10)", v, undefined, [
      raw("Base Max", asNumber(cell(DreamUpg, 10, 2)), "DreamUpg[10][2] game constant"),
      raw("Summoning WinBonus 24", win24, "slot 24 is RAW (no multiplicative chain)", [
        raw("Normal Wins Bonus", win24 - endless, "Σ slot-24 contributions from owned summoning units"),
        raw("Endless Wins Bonus", endless, "floor(wins/40) × perCycle + partial cycle", [raw("Endless Wins Count", wins, "OLA[319] — total endless summoning victories"), raw("Per 40-Cycle Bonus", ringOf(24, 40), "slot-24 contribution per 40-win cycle (game constant)")]),
      ]),
      raw("SuperBit 35 (×10)", 10 * GamingStatType(c, "SuperBitType", 35, 0), "Gaming SuperBitType 35 unlocked? × 10"),
      raw("Cloud 30 (×4)", 4 * Dreamstuff(c, "CloudBonus", 30), "Dream Challenge 30 completed? × 4"),
    ]);
  });
}

type SuperOpts = {
  /** The super levels are a row of their own (`superLevelsRow`), not a term of the Bonus Levels. */
  split?: boolean;
  /** The talent counts as a super talent whatever the preset lists (the Hypothetical tab). */
  forceSuper?: boolean;
};

const banned = (c: Ctx, id: number): boolean => 1 == RunCodeOfTypeXforThingY(c, "TalentBannedforAllLV", `${id}`);

/** `Super Levels`: the Spelunk super talent's levels as a row of their own; 0 with `Active` 0 and what it would give while the talent is not listed. Null for a talent that takes no bonus levels. */
function superLevelsRow(c: Ctx, id: number, who: number, anyPreset: boolean, force: boolean): ArkhNode | null {
  if (banned(c, id)) return null;
  return guarded("Super Levels", () => {
    const on = force || superListed(c, id, who, anyPreset);
    const potential = Thingies(c, "SuperTalentPTS_LVgiven", 0, 0);
    const note = on ? "Spelunk Super Talent — active on this preset" : `Spelunk Super Talent — inactive (would give +${potential} if super-talented on this preset)`;
    return row("Super Levels", on ? potential : 0, "+", note, [raw("Active", on ? 1 : 0), ...(on ? superTalentRow(c, id, who, anyPreset, true)!.children! : [])]);
  });
}

/** `Bonus Levels`: the terms N.js AllTalentLV sums, in the rows' order, then floor(min(cap, sum) + the super levels). The terms all read the current player's; only the super talent reads `who`. */
function bonusLevelsRow(c: Ctx, id: number, who: number, anyPreset: boolean, o: SuperOpts = {}): ArkhNode {
  if (banned(c, id)) return row("Bonus Levels", 0, "+");
  const sup = o.split ? null : guarded("Spelunk Super Talent", () => superTalentRow(c, id, who, anyPreset, o.forceSuper));
  const terms = present([
    ...[149, 374, 539].map((t) => guarded(SYMBOLS[t], () => symbolsRow(c, t))),
    guarded("Maroon Warship (Achievement 291)", () => when(AchieveStatus(c, 291), (v) => raw("Maroon Warship (Achievement 291)", v))),
    guarded("Family Bonus 68 (Mage)", () => familyBonusRow(c)),
    guarded("Rift Slug (Companion 1)", () => when(Companions(c, 1), (v) => raw("Rift Slug (Companion 1)", v, undefined, [raw("Owned", 1), raw("Bonus", v)]))),
    guarded("Divinity Minor 2 (Arctis)", () => divinityRow(c)),
    guarded("Equinox Symbols (Dream 10)", () => equinoxRow(c)),
    guarded("Sneaking Completions", () => when(5 * Math.floor((97 + asNum(c, "OptionsListAccount", 232)) / 100), (v) => raw("Sneaking Completions", v, `raw=${asNum(c, "OptionsListAccount", 232)}`))),
    guarded("Skull of Major Talent (Grimoire 39)", () => when(Summoning(c, "GrimoireUpgBonus", 39, 0), (v) => raw("Skull of Major Talent (Grimoire 39)", v))),
    guarded("Kattlekruk Set", () => when(GetSetBonus(c, "KATTLEKRUK_SET", "Bonus", 0, 0), (v) => raw("Kattlekruk Set", v))),
    guarded("Universe Talent", () => when(Math.min(5, ArcaneType(c, "ArcaneUpgBonus", 57, 0)), (v) => raw("Universe Talent", v, "Tesseract (Arcane Cultist) — +1 talent LV per level, cap 5"))),
    guarded("Super Bit 47 Lv Bonus", () =>
      when(Math.max(0, Math.floor(((asNum(c, "Lv0", 0) - 500) / 100) * GamingStatType(c, "SuperBitType", 47, 0))), (v) => raw("Super Bit 47 Lv Bonus", v, "max(0, floor((Lv − 500)/100))", [raw("Player Lv", asNum(c, "Lv0", 0), "Lv0[0]")]))
    ),
  ]);
  const sum = terms.reduce((a, t) => a + t.val, 0);
  let cap = 9999; // DNSM.AllTalMaxCapFR
  const capRead = 225 <= id && 239 >= id ? guarded("Royal Armory cap (Armory 55 — Talent Reattainment)", () => ((cap = RoyalG(c, "ArmoryUpgBonus", 55, 0)), null)) : null;
  const over = cap < sum ? raw("Royal Armory cap (Armory 55 — Talent Reattainment)", cap - sum, `All Talent LV bonuses reach Royal Guardian talents only up to ${cap} (was ${sum}); super-talent levels are not capped`) : null;
  return row("Bonus Levels", Math.floor(Math.min(cap, sum) + (sup?.val ?? 0)), "+", undefined, present([sup, ...terms, capRead, over]));
}

// ===== A talent's level =====

/** `decay(40,65,268)`: a talent's first curve at the level the current character reads it, its points plus the bonus levels (the game's `AllTalentLV` when the character has a point; the rows say what it would read when not). */
export const talentNote = (c: Ctx, id: number): string => curveNote(id, skillLevel(c, id) + bonusLevelsRow(c, id, c.player, false).val);

export type TalentRowsOpts = SuperOpts & {
  /** The cap row of a talent that has its own, in place of the Max Book Lv Cap (the cap boosters); null: the talent has none. */
  capOf?: (c: Ctx, id: number, who: number) => ArkhNode | null;
  /** The talent as `getbonus2(1, id, -1)` reads it: the best character's whole chain (N.js @7987852). Default: the current character's, as `GetTalentNumber` reads it. */
  best?: boolean;
};

/** The character `getbonus2(1, id, -1)` takes its value from: the first with the highest (-1: none above 0). `force`: the talent counts as a super talent for each of them (the levels it has not got yet are added). */
function bestCharacter(c: Ctx, id: number, force = false): number {
  let best = 0;
  let who = -1;
  for (let g = 0, n = playerCount(c); g < n; g++) {
    const level = skillLevel(c, id, g);
    const forced = force && 100 <= id && 0 < level && !banned(c, id) && !superListed(c, id, g, true) ? Thingies(c, "SuperTalentPTS_LVgiven", 0, 0) : 0;
    const value = talentCurveAt(c, 1, id, 100 <= id && 0 < level ? level + forced + RunCodeOfTypeXforThingY(c, "AllTalentLVz", `${id}|${g}`) : level);
    if (value > best) {
      best = value;
      who = g;
    }
  }
  return who;
}

/** The stars whose cap is K x (the task shop's level + 1) of a world's Tasks[2]: id -> [K, world]. The game rewrites SkillLevelsMAX only on a purchase, so the saved cap lags the live level. */
const STAR_TASK_MAX: Record<number, readonly [number, number]> = { 627: [5, 0], 630: [5, 1], 634: [5, 2], 651: [20, 3], 652: [30, 4] };

function starRows(c: Ctx, id: number): ArkhNode[] {
  const level = skillLevel(c, id);
  // the game syncs SkillLevelsMAX over the account: the row is the highest of them, raised to the live cap of the stars that have one (641-647: the book cap, which the saved one lags as it grows)
  const top = present([
    guarded("Max Level", () => {
      let max = 0;
      for (let g = 0, n = playerCount(c); g < n; g++) max = Math.max(max, asNumber(opt(c.state, charKey("SM", g), id)));
      const task = STAR_TASK_MAX[id];
      if (task) max = Math.max(max, task[0] * (asNum(c, "Tasks", 2, task[1], 3) + 1));
      else if (641 <= id && 647 >= id) max = Math.max(max, maxBookLv(c));
      return when(max, (v) => raw("Max Level", v, "star talent cap (account SkillLevelsMAX)"));
    }),
  ]);
  return [raw("Active", 0 < level ? 1 : 0), raw("Level", level, "star talent — pool capped, no book lv"), ...top];
}

/**
 * The rows under a talent, the same for every source that shows one: `Active` and `Effective Level` (`Base Level` with its `Max Book Lv Cap`, `Bonus Levels` with each bonus); a star talent (615 on) has `Level` and `Max Level`
 * instead; `best` shows the best character's chain, under a `Reference Character` row. The row carrying the talent's name, value and note is the caller's.
 */
export function talentLevelRows(c: Ctx, id: number, o: TalentRowsOpts = {}): ArkhNode[] {
  const note = o.split ? "Base + Bonus + Super" : "Base + Bonus";
  /** The Bonus Levels row and, when split, the Super Levels row after it. */
  const bonus = (who: number, anyPreset: boolean): ArkhNode[] => present([bonusLevelsRow(c, id, who, anyPreset, o), o.split ? superLevelsRow(c, id, who, anyPreset, !!o.forceSuper) : null]);
  const sum = (rows: ArkhNode[]) => rows.reduce((a, r) => a + r.val, 0);
  if (o.best) {
    const who = bestCharacter(c, id, o.forceSuper);
    const reference = `Reference Character: ${ownerName(c, who)}`;
    if (0 > who) return [raw(reference, 0)];
    const level = skillLevel(c, id, who);
    const bonuses = 100 <= id ? bonus(who, true) : [row("Bonus Levels", 0, "+")];
    return [raw("Effective Level", level + sum(bonuses), undefined, [baseLevelRow(c, level, who, reference, o.capOf?.(c, id, who) ?? undefined), ...bonuses])];
  }
  if (615 <= id) return starRows(c, id);
  const level = skillLevel(c, id);
  const bonuses = bonus(c.player, false);
  return [raw("Active", 0 < level ? 1 : 0), raw("Effective Level", level + sum(bonuses), note, [baseLevelRow(c, level, c.player, undefined, o.capOf?.(c, id, c.player) ?? undefined), ...bonuses])];
}

// ===== The sources =====

export const TALENT_EXPLAINERS: Record<string, Explainer> = {
  talent279: (c) => talentLevelRows(c, 279),
  talent24: (c) => talentLevelRows(c, 24),
  talent655: (c) => [...talentLevelRows(c, 655), raw("Per Skull", GetTalentNumber(c, 1, 655)), raw("Skulls Beaten", asNum(c, "OptionsListAccount", 189), "OLA[189] — count of skulls beaten")],
  talent239: (c) => [
    row("Graded Rate (Talent 239)", GetTalentNumber(c, 1, 239), "+", talentNote(c, 239), talentLevelRows(c, 239)),
    raw("Total Resource Grades", RoyalG(c, "TotalStatz", 0, 0), "Σ RoyalG[5] — every resource node's Grade, all worlds"),
  ],
  workbench: (c) => [
    ...talentLevelRows(c, 328, { best: true }),
    raw("Talent Value", getbonus2(c, 1, 328, -1), "formula(effective_lv) — coefficient"),
    raw("Plunderous Kills", asNum(c, "OptionsListAccount", 139), "OLA[139] — kills of plunderous mobs"),
  ],
};
