// The EXP Multi tracker: the page's { tree, total } for N.js ExpMulti(0) (the "Class EXP" line of Player Info), built from the ONE traced call.
//
// The number is TRACKERS.expMulti (ExpMulti(0), njs/ExpMulti.ts). ExpMulti is one scalar block: its working values (DNSM.ExpGainLUK .. LUK6) are
// locals, so the tree is read out of the trace, as the AFK and Damage trackers do (trackers/afkGains.ts, damage.ts): each source finds the
// call(s) it stands for among ExpMulti's direct calls (by block and arguments, each call once, in call order), takes their values and carries the
// calls' own N.js trace as children. A number ExpMulti reads from the save itself (the bun_q bundle, the weekly boss, the level ladders) is a leaf.
// The source's value is the term as lib/arkh's tree had it and the game writes it: the FACTOR in a `mult` group, the % points in a `pct` group
// (the TERMS table of __tests__/lib/game/njs/expTerms.test.ts writes every one as its N.js sub-expression). The groups, ids and
// names are display (lib/expMulti/layers.ts and the table below: the names lib/arkh's tree had, which the page's Biggest Gains and the Observed
// Max data are keyed by); a node's value is only what it shows, and the total never comes from the tree.
//
// The trace below a source is trimmed (Ruling L, trackers/page.ts). The reads that are no source but lead to a `runtime:` / `assumed:` note stay
// visible under the root.
//
// Decisions in force: Ruling II, the Shiny Medallion gate is the medallion of MapAFKtarget[ctx.map] (never the saved AFK target); Ruling Y, a
// dungeon map counts as outside a dungeon (the Dungon stand-in leaves an `assumed:` note inside a talent). EXP has no "no value" map (Ruling DD
// does not apply): a map whose target is no monster just shuts the medallion gate, and the formula runs as always.
//
// Performance, measured when the page switched (a one-off perf script, since deleted; 4 real saves, Node, median): the first call on a save 44 ms against
// lib/arkh's 25 ms, a character switch 16 ms against 14 ms and a map switch 16 ms against 15 ms: parity when warm, a one-off cost per save.
//
// The recombination guard rebuilds the total from the tree with the page's own Biggest Gains model (groupedGainsModel over EXP_GROUPS, one path
// for the number, spec section 4): if the sources no longer give ExpMulti's total (an N.js constant changed in one place only) it throws
// TreeTotalMismatch, so the tracker reads "incomplete" instead of showing a number the headline does not match.
//
// The type of the result is the page's own (lib/statTracker/config StatResult: type-only).
import type { StatResult } from "@/lib/statTracker/config";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { EXP_GROUPS, EXP_ROOT, EXP_VOTE_NAME } from "@/lib/expMulti/layers";
import { groupNote, groupVal } from "@/lib/statTracker/groups";
import { asNum, attr } from "../attr";
import { makeCtx, type Ctx, type TraceNode } from "../ctx";
import { MapAFKtarget } from "../data";
import { listAt } from "../lists";
import { ExpMulti, lukCurve } from "../njs/ExpMulti";
import { haveBan } from "../njs/Thingies";
import type { GameState } from "../state";
import { findCall, finishTree, optFrom, migratedNote, stateOf, takeFrom, type Take } from "./page";

type Node = StatResult["tree"];

const READ = "a plain read of the save, not an N.js call";

/**
 * What a source computes from: `t` takes a call (it must exist), `o` takes it when ExpMulti made it (a branch the game skips makes none),
 * `has` asks whether ExpMulti made it, `peek` reads a call another source took, `leaf` shows a number that is no call of its own, `c` reads the save.
 */
type Ops = {
  t: Take;
  o: (block: string, ...args: (string | number)[]) => number | undefined;
  has: (block: string, ...args: (string | number)[]) => boolean;
  peek: Take;
  leaf: (name: string, val: number, note?: string) => number;
  c: Ctx;
};
/** One source of the tree: its name and note as lib/arkh's tree had them, and `of`, the term as ExpMulti uses it (see the header). */
type Source = { name: string; note?: string | ((c: Ctx) => string); of: (o: Ops) => number };

/** The newbie ladder: an exclusive `Lv0 < 10 ? 150 : Lv0 < 30 ? 100 : Lv0 < 50 ? 50 : 0`. */
const newbie = (lv: number): number => (10 > lv ? 150 : 30 > lv ? 100 : 50 > lv ? 50 : 0);

// Offsets (raw N.js): ExpMulti @4260536 (the lowest-level loop @4261156, the Shiny Medallion gate @4264489)
const SOURCES: Record<string, Source> = {
  workbench: { name: "Archlord Of The Pirates (Talent 328)", of: ({ t }) => t("WorkbenchStuff", "AdditionExtraEXPnDR", 0, 0) },
  bunQ: { name: "EXP Bundle", note: "bun_q: Equinox Valley pack, +20% Class EXP; no in-game title", of: ({ leaf, c }) => 20 * leaf("BundlesReceived.bun_q", haveBan(c, "bun_q"), "Owned") },
  superbit19: { name: "Noobie Gains (Super Bit 19)", note: "Only the account's lowest-level character gets it", of: ({ o }) => 1 == o("GamingStatType", "SuperBitType", 19, 0) ? 50 : 0 },
  medallion429: { name: "Shiny Medallions (Talent 429)", note: (c) => `Map ${c.map} · ${String((MapAFKtarget as unknown as readonly unknown[])[c.map | 0] ?? "")}`, of: ({ o }) => { const v = o("getbonus2", 1, 429, -1); return undefined === v ? 1 : Math.max(1, v); } },
  comp37: { name: "Whallamus (Companion 37)", of: ({ t }) => 1 + 9 * t("Companions", 37) },
  comp33: { name: "Chippy (Companion 33)", of: ({ t }) => 1 + t("Companions", 33) },
  comp160: { name: "Glunko The Massive (Companion 160)", of: ({ t }) => 1 + 4 * t("Companions", 160) },
  comp32: { name: "Whale (Companion 32)", of: ({ t }) => 1 + t("Companions", 32) },
  arenaCruc15: { name: "1.20x Class EXP (Pet Arena Crucible 15)", note: "×1.2 once the Crucible's 16th wave is cleared (RANDOlist[115][15])", of: ({ t }) => 1 + 0.2 * t("Breeding", "PetArenaCrucBonus", "0", 15, 0) },
  menagerie23: { name: "Menagerie Boost: Class EXP gain (Boost 23)", of: ({ t }) => 1 + t("MenagerieStuff", "BoostQTY", 23, 0) / 100 },
  comp168: { name: "Crystal Glunko (Companion 168)", of: ({ t }) => 1 + 0.4 * t("Companions", 168) },
  comp34: { name: "Bunny (Companion 34)", of: ({ t }) => 1 + t("Companions", 34) },
  comp145: { name: "Eggroll (Companion 145)", of: ({ t }) => 1 + t("Companions", 145) },
  jelly30: { name: "Surrage (Jelly Obstruction 31)", note: "Jelly Bonus 30: x Class EXP gain", of: ({ t }) => 1 + t("JellyOperation", "RoG_BonusQTY", 30, 0) / 100 },
  jelly62: { name: "Tribunal Helmet (Jelly Obstruction 63)", note: "Jelly Bonus 62: x Class EXP gain", of: ({ t }) => 1 + t("JellyOperation", "RoG_BonusQTY", 62, 0) / 100 },
  comp128: { name: "Baby Troll (Companion 128)", of: ({ t }) => 1 + (Math.min(0.5, t("Companions", 128)) + 0.25 * t("CompLV2", 128)) },
  gridExp: { name: "Legendary Fevers (Research Grid 130·131·132·152)", note: "Legendary Yellow / Red / Brown / Green Fever", of: ({ t }) => 1 + (t("ResearchStuff", "Grid_Bonus", 130, 0) + (t("ResearchStuff", "Grid_Bonus", 131, 0) + (t("ResearchStuff", "Grid_Bonus", 132, 0) + t("ResearchStuff", "Grid_Bonus", 152, 0)))) / 100 },
  sticker0: { name: "Mega Mongo Sticker (Sticker 0)", of: ({ t }) => 1 + t("FarmingStuffs", "StickerBonus", 0, 0) / 100 },
  superbit63: { name: "Experienced Gamer (Super Bit 63)", of: ({ t }) => 1 + 0.1 * t("GamingStatType", "SuperBitType", 63, 0) },
  zenith9: { name: "Classy Gogo (Zenith Market 9)", of: ({ t }) => 1 + t("Thingies", "ZenithMarketBonus", 9, 0) / 100 },
  comp50: { name: "Santa Snake (Companion 50)", of: ({ t }) => Math.max(1, Math.min(1.01, 1 + t("Companions", 50) / 2500)) },
  etc84: { name: "Bonus Class EXP (Equipment)", note: "EtcBonuses(84) = %_BONUS_CLASS_EXP", of: ({ t }) => 1 + t("EtcBonuses", "84") / 100 },
  card100: { name: "Class EXP Multi Cards (Card Type 100)", of: ({ t }) => 1 + t("CardBonusREAL", 100) / 100 },
  arcade60: { name: "Class XP Multi Arcade Bonus (Arcade 60)", of: ({ t }) => 1 + t("ArcadeBonus", 60) / 100 },
  vialClassExp: { name: "Crabomayse (Vial 83)", note: "Vial effect key 7classexp", of: ({ t }) => 1 + t("DNSM.AlchVials", "7classexp") / 100 },
  talent434: { name: "Slayer Abominator (Talent 434)", of: ({ t }) => Math.pow(Math.max(1, t("getbonus2", 1, 434, -1)), t("Windwalker", "TotalTitanKills", 0, 0)) },
  arcane1: { name: "Arcane Map Bonus: Class EXP", note: "MapBon slot 1 (slot 0 = DR, 2 = AFK)", of: ({ t }) => 1 + t("ArcaneType", "ArcaneMapMulti_bon", 1, 0) / 100 },
  bigFish4: { name: "Advice on Being Smart (Big Fish 4)", note: "x Class EXP gain", of: ({ t }) => 1 + t("Spelunk", "BigFishBonuses", 4, 0) / 100 },
  dancingCoral3: { name: "Class EXP (Dancing Coral 3)", note: "Depends on the Pantheon Shrine level (TowerInfo[21])", of: ({ t }) => 1 + t("Thingies", "DancingCoralBonus", 3, 0) / 100 },
  coralKid: { name: "Coral Kid Upgrade 2", note: "(1 + bonus/100) ^ (God Rank - 10); bonus = 20·OLA[429]/(25 + OLA[429]); upgrades bought with Singularity Spirals", of: ({ t, leaf, c }) => Math.pow(1 + t("Thingies", "CoralKidUpgBonus", 2, 0) / 100, Math.max(0, leaf("Divinity[25]", asNum(c, "Divinity", 25), "God rank") - 10)) },
  cardSet12: { name: "Class EXP Multi Set Bonus (Card Set 12)", of: ({ t }) => 1 + t("CardSetBonuses", 0, "12") / 100 },
  bubba6: { name: "XP Multi (Bubba RoG 6)", note: "Bubba the Seal RoG bonus 6", of: ({ t }) => 1 + t("Bubbastuff", "BubbaRoG_Bonuses", 6, 0) / 100 },
  sushi15: { name: "Tobiko Temaki (Sushi Tier 16)", note: "RoG Bonus 15: x Class EXP gain", of: ({ t }) => 1 + t("SushiStuff", "RoG_BonusQTY", 15, 0) / 100 },
  cloud70: { name: "Palette Lv. 100 (Equinox Challenge 70)", note: "Reach Lv. 100 on any Palette colour; reward 1.05x Class EXP (×5 → 5 × 1%)", of: ({ t }) => 1 + (5 * t("Dreamstuff", "CloudBonus", 70)) / 100 },
  fountain16: { name: "Class EXP Boost (Fountain 16)", note: "Fountain upgrade 16 (tier 0)", of: ({ t }) => 1 + t("Holes2", "Fountain_BonTOT", 0, 16) / 100 },
  royalStatue3: { name: "Royal Statue: Class Exp", of: ({ t }) => 1 + t("RoyalG", "StatueBon", 3, 0) / 100 },
  classy: { name: "Classy Discoveries", of: ({ t, leaf, c }) => Math.max(1, Math.pow(1.03, leaf("Spelunk[6].length", listAt(c, "Spelunk", 6).length)) * t("GamingStatType", "SuperBitType", 24, 0) * (1 + t("Summoning2", "MeritocBonusz", 27, 0) / 100)) },
  etc78: { name: "Class EXP Multi (Equipment)", note: "EtcBonuses(78) = %_CLASS_EXP_MULTI", of: ({ t }) => t("EtcBonuses", "78") },
  luk: { name: "LUK Scaling (Class EXP)", of: ({ t }) => (100 * lukCurve(t("TotalStats", "LUK"))) / 1.8 },
  talent35: { name: "Lucky Charms (Talent 35)", of: ({ t, peek }) => (lukCurve(peek("TotalStats", "LUK")) * t("GetTalentNumber", 1, 35)) / 1.8 },
  etc4: { name: "XP from Monsters (Equipment)", note: "EtcBonuses(4) = %_XP_FROM_MONSTERS", of: ({ t }) => t("EtcBonuses", "4") },
  boxMonsterExp: { name: "Box of Unwanted Stats (Post Office 3c)", note: "% Monster EXP (third slot of box 3)", of: ({ t }) => t("DNSM.BoxRewards", "monsterExp") },
  food: { name: "Food (Class EXP)", of: ({ t }) => t("TotalFoodBonuses", "ClassEXP") },
  starSignMainXP: { name: "Star Signs: Main EXP", note: "StarSigns.MainXP: The Book Worm (2), The Big Brain (24), Big Brain Major (52)", of: ({ t }) => t("DNSM.StarSigns", "MainXP") },
  vialMonsterExp: { name: "Mimicraugh (Vial 17)", note: "Vial effect key MonsterEXP", of: ({ t }) => t("DNSM.AlchVials", "MonsterEXP") },
  bubbleExp: { name: "Grind Time (Kazam Cauldron)", note: "ACTIVE bubble (key expACTIVE): counts only with Sheepie or when equipped", of: ({ t }) => t("DNSM.AlchBubbles", "expACTIVE") },
  card44: { name: "Monster EXP Cards (Card Type 44)", note: "Card type 44 = +% EXP from monsters", of: ({ t }) => t("CardBonusREAL", 44) },
  merit3: { name: "Merit: EXP for Lowest-Level Character", note: "Taskboard merit (Tasks[2][0][2]): +3% per level, lowest-level character only", of: ({ has, leaf, c }) => has("Summoning", "VaultUpgBonus", 12, 0) ? 3 * leaf("Tasks[2][0][2]", asNum(c, "Tasks", 2, 0, 2), "Merit level") : 0 },
  vault12: { name: "Baby on Board (Vault 12)", note: "Lowest-level character only", of: ({ o }) => o("Summoning", "VaultUpgBonus", 12, 0) ?? 0 },
  cardSet0: { name: "EXP if below Lv 50 Set Bonus (Card Set 0)", note: "Only below level 50", of: ({ o }) => o("CardSetBonuses", 0, "0") ?? 0 },
  mealClexp: { name: "Class EXP Meals (below Lv 120)", note: "MealBonus(\"Clexp\"): no meal in MealINFO carries this key, so it is always 0 (same in N.js)", of: ({ o }) => o("MealBonus", "Clexp") ?? 0 },
  weeklyBoss: { name: "Weekly Boss", of: ({ leaf, c }) => Object.hasOwn(attr(c, "WeeklyBoss") as object, "c") ? Math.min(150, leaf("WeeklyBoss.c", asNum(c, "WeeklyBoss", "c"))) : 0 },
  newbie: { name: "Newbie Bracket", of: ({ leaf, c }) => newbie(leaf("Class Level", asNum(c, "Lv0", 0))) },
  divMinor4: { name: "Class EXP (Divinity Minor Bonus 4)", note: "The active character's linked god, minor type 4", of: ({ t, c }) => t("Divinity", "Bonus_Minor", c.player, 4) },
  cardSet5: { name: "Card Set 5 (Damage · Drop · EXP)", of: ({ t }) => t("CardSetBonuses", 0, "5") },
  statue10: { name: "EXP Statue (Statue 10)", note: "Added directly, no ÷ 100", of: ({ t }) => t("ArbitraryCode", "StatueBonusGiven10") },
  talent632: { name: "Just EXP (Talent 632)", of: ({ t }) => t("GetTalentNumber", 1, 632) },
  shrine5: { name: "Summereading Shrine (Shrine 5)", of: ({ t }) => t("Shrine", 5) },
  saltLick3: { name: "Class EXP and Skill EXP (Salt Lick 3)", of: ({ t }) => t("SaltLick", 3) },
  prayer0: { name: "Big Brain Time (Prayer 0)", of: ({ t }) => t("prayersReal", 0, 0) },
  prayer2: { name: "Unending Energy (Prayer 2)", of: ({ t }) => t("prayersReal", 2, 0) },
  prayer9: { name: "The Royal Sampler (Prayer 9) (curse)", of: ({ t }) => -t("prayersReal", 9, 1) },
  flurbo2: { name: "Class Exp (Flurbo Shop 2)", of: ({ t }) => t("FlurboShop", 2) },
  ach57: { name: "Dungeon Pinch (Achievement 57)", of: ({ t }) => t("AchieveStatus", 57) },
  ach357: { name: "Unreal Overgrowth (Achievement 357)", note: "× 20", of: ({ t }) => 20 * t("AchieveStatus", 357) },
  ach61: { name: "2 Minute Meal (Achievement 61)", note: "× 3", of: ({ t }) => 3 * t("AchieveStatus", 61) },
  ach124: { name: "Dungeon Slap (Achievement 124)", note: "× 2", of: ({ t }) => 2 * t("AchieveStatus", 124) },
  ach188: { name: "Capitalist Win (Achievement 188)", note: "× 5", of: ({ t }) => 5 * t("AchieveStatus", 188) },
  arcade12: { name: "Class EXP Gain Arcade Bonus (Arcade 12)", of: ({ t }) => t("ArcadeBonus", 12) },
  sigil8: { name: "Metal Exterior Sigil (Sigil 8)", of: ({ t }) => t("Labb", "SigilBonus", "Blank", 8, 0) },
  ach286: { name: "No Krakens? ): (Achievement 286)", note: "× 25", of: ({ t }) => 25 * t("AchieveStatus", 286) },
  shiny1: { name: "Class EXP Shiny Pet (Breeding 1)", of: ({ t }) => t("Breeding", "ShinyBonusS", "Nah", 1, -1) },
  msa4: { name: "MSA Totalizer (Class EXP)", of: ({ t }) => t("GamingStatType", "MSA_Bonus", 4, 0) },
  talent55: { name: "EXP Cultivation (Talent 55)", of: ({ t }) => t("getbonus2", 1, 55, -1) },
  cardSpring: { name: "Bubbulyte (Card springEvent1)", note: "× 2 per card level", of: ({ t }) => 2 * t("RunCodeOfTypeXforThingY", "CardLv", "springEvent1") },
  comp3: { name: "Crystal Custard (Companion 3)", of: ({ t }) => t("Companions", 3) },
  comp50add: { name: "Santa Snake (Companion 50)", of: ({ t }) => t("Companions", 50) },
  shimmer179: { name: "Island Shimmer", note: "OLA[179] × AllShimmerBonuses (The Shim Lantern, Artifact 31)", of: ({ t, leaf, c }) => leaf("OptionsListAccount[179]", asNum(c, "OptionsListAccount", 179), "Shimmer count") * t("Dreamstuff", "AllShimmerBonuses", 0) },
  goldFood: { name: "Golden Nigiri (Golden Food)", note: "Σ of equipped + Emporium golden foods with effect ClassEXPz", of: ({ t }) => t("GoldFoodBonuses", "ClassEXPz") },
  owl0: { name: "Bonuses of Orion (Owl Upgrade 0)", note: "Orion the Horned Owl: permanent +% Class XP (owl bonus 0)", of: ({ t }) => t("Summoning", "OwlBonuses", 0, 0) },
  vote15: { name: EXP_VOTE_NAME, note: "Only counts the week vote 15 wins", of: ({ t }) => t("Summoning", "VotingBonusz", 15, 0) },
  monument1_6: { name: "Justice Monument: Class EXP Gain", of: ({ t }) => t("Holes", "MonumentROGbonuses", 1, 6) },
  compass51: { name: "Moon of Experience (Compass 51)", of: ({ t }) => t("Windwalker", "CompassBonus", 51, 0) },
  hole47: { name: "Gloomie Expie (Cavern Upgrade 47)", note: "+25% Class EXP per Gloomie Mushroom colony cleared", of: ({ t }) => t("Holes", "B_UPG", 47, 0) },
  win23: { name: "Class EXP (Winner Bonus 23)", note: "Summoning winner bonus 23", of: ({ t }) => t("ExpMulti", 999) },
  grimoire24: { name: "Skull of Major Experience (Grimoire 24)", of: ({ t }) => t("Summoning", "GrimoireUpgBonus", 24, 0) },
  vault3: { name: "Wicked Smart (Vault 3)", of: ({ t }) => t("Summoning", "VaultUpgBonus", 3, 0) },
  vault35: { name: "Schoolin' the Fish (Vault 35)", note: "× log10(total fish caught) (OLA[345])", of: ({ t, c }) => t("Summoning", "VaultUpgBonus", 35, 0) * t("getLOG", asNum(c, "OptionsListAccount", 345)) },
  hole83: { name: "Sanctum of EXP (Cavern Upgrade 83)", note: "+40% Class EXP per Sanctum of Ancient Golems cleared", of: ({ t }) => t("Holes", "B_UPG", 83, 40) },
  ironSet: { name: "Iron Set", of: ({ t }) => t("GetSetBonus", "IRON_SET", "Bonus", 0, 0) },
  exotic50: { name: "Intelleaf (Exotic Market 50)", note: "Doubled by a Menagerie doubler", of: ({ t }) => t("FarmingStuffs", "ExoticBonusQTY", 50, 0) },
  ola421: { name: "Class EXP from Monsters (Hoops Shop 2)", note: "Level of Hoops shop upgrade 2 (OLA[421])", of: ({ leaf, c }) => leaf("OptionsListAccount[421]", asNum(c, "OptionsListAccount", 421), "Hoops shop level") },
  stampClassxp: { name: "Gud EXP Stamp (Stamp A44)", note: "StampBonusOfTypeX(\"classxp\")", of: ({ t }) => t("StampBonusOfTypeX", "classxp") },
  friend1: { name: "Class EXP Gain (Friend Bonus 1)", note: "Friend bonus type 1; scales with account level", of: ({ t }) => t("Thingies", "FriendBonusStatz", 1, 0) },
  comp47: { name: "Baby Boa (Companion 47)", of: ({ t }) => t("Companions", 47) },
  comp111: { name: "Clammie (Companion 111)", of: ({ t }) => t("Companions", 111) },
  button8: { name: "Class XP (Minehead Button 8)", note: "Button slot 8", of: ({ t }) => t("Minehead", "Button_Bonuses", 8, 0) },
  comp128add: { name: "Baby Troll (Companion 128)", of: ({ t }) => t("Companions", 128) },
};

// The page's Biggest Gains model: the guard below recombines the tree with it (the one path for the number).
const MODEL = groupedGainsModel(EXP_ROOT, EXP_GROUPS);

/**
 * The page's result for the character and map of a traced Ctx (nothing computed on it yet): runs `ExpMulti(0)` once, then reads the tree out of
 * the call it made. A save the game would not have the keys for (Ruling E) throws what the engine throws (MissingSaveKey...).
 */
export function expTree(ctx: Ctx): StatResult {
  if (!ctx.trace) throw new Error("EXP Multi: the tree is read from the trace, and this Ctx has none");
  const state = ctx.state;
  const total = ExpMulti(ctx, 0); // the one call (TRACKERS.expMulti, trackers/index.ts)
  const root = ctx.trace;
  const call = root.children.find((n) => n.block === "ExpMulti" && 0 === n.args[0] && "cached" !== n.note);
  if (!call) throw new Error("EXP Multi: no ExpMulti(0) call in the trace");
  const plain: Ctx = { ...ctx, trace: null }; // the adapter's own save reads leave nothing in the trace
  const used = new Set<TraceNode>();

  const source = (id: string, fmt: "x" | "+"): Node => {
    const def = SOURCES[id];
    if (!def) throw new Error(`EXP Multi: no source "${id}" in the adapter`);
    const kept: Node[] = [];
    const t = takeFrom(call, used, kept, "EXP Multi: ExpMulti", id);
    const o = optFrom(call, used, kept);
    const has = (block: string, ...args: (string | number)[]) => undefined !== findCall(call, block, args);
    const peek: Take = (block, ...args) => {
      const n = findCall(call, block, args);
      if (!n) throw new Error(`EXP Multi: ExpMulti made no ${block}(${args.map((a) => JSON.stringify(a)).join(", ")}) call for "${id}"`);
      return n.value;
    };
    const leaf = (name: string, val: number, note = READ) => (kept.push({ name, val, fmt: "raw", note }), val);
    const val = def.of({ t, o, has, peek, leaf, c: plain });
    const note = typeof def.note === "function" ? def.note(plain) : def.note;
    return { name: def.name, val, fmt, ...(note ? { note } : {}), ...(kept.length ? { children: kept } : {}) };
  };

  const groups: Node[] = EXP_GROUPS.map((g) => {
    const items = g.sources.map((id) => source(id, g.kind === "mult" ? "x" : "+"));
    return { name: g.name, val: groupVal(g, items.map((i) => i.val)), fmt: "x", note: groupNote(g), children: items };
  });

  const migrated = migratedNote(state);
  const tree: Node = { name: EXP_ROOT, val: total, fmt: "x", ...(migrated ? { note: migrated } : {}), children: groups };
  return finishTree(tree, total, MODEL, root, call, used);
}

/** `computeArkhExpMulti`'s counterpart on a built state: ExpMulti(0) once, with the trace on, and the tree read out of it. */
export const gameExpMulti = (state: GameState, charIdx: number, mapIdx: number): StatResult => expTree(makeCtx(state, { player: charIdx, map: mapIdx, trace: true }));

/** `computeArkhExpMulti`'s counterpart: the envelope of a save, a character index and the map to compute on. */
export function computeGameExpMulti(save: unknown, charIdx: number, mapIdx: number): StatResult {
  return gameExpMulti(stateOf(save), charIdx, mapIdx);
}
