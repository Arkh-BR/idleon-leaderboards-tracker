// The Coin Multi tracker: the page's { tree, total } for N.js ArbitraryCode("MonsterCash") (the "Total Coin Bonus from all sources" line of Upgrade Vault 2, Monster Tax),
// built from the ONE traced call.
//
// The number is TRACKERS.coinMulti (ArbitraryCode(ctx, "MonsterCash"), njs/ArbitraryCode.ts). The block is one expression: it keeps no working values, so the tree is
// read out of the trace as the Drop Rate and EXP trackers do (trackers/dropRate.ts): each source finds the call(s) it stands for among the block's direct calls (by block
// and arguments, each call once), takes their values and carries the calls' own N.js trace as children. A number the block reads from the save itself (the Hoops shop
// level, the bundle) is a leaf. A source's value is the term as lib/arkh's tree had it and the game writes it: the % points in a `pct` group (the sum of `1 + sum/100`),
// the amount a `raw` or `min4` group adds to its 1. The groups, ids and names are display (lib/coinMulti/layers.ts and the table below: the names lib/arkh's tree had,
// which the page's Biggest Gains and the Observed Max data are keyed by); a node's value is only what it shows, and the total never comes from the tree.
//
// Every source is a call the block makes on every pass (it is a single expression with no branch), so none needs the guarded read the Drop Rate chip does (chipUncalled).
// The map (Ruling Y: a dungeon map counts as outside a dungeon) reaches two sources: the guild term reads `ctx.map` (1 + floor(map / 50)) and TalentCalc(643) reads the AFK
// target through it. A map with no monster on its target (33) is refused as the block refuses it (InvalidSaveValue).
//
// The trace below a source is trimmed (Ruling L, trackers/page.ts). The `assumed:` leaves the block reaches (for example DNSM.CalcTalentMAP["643"] under the Coins For Charon source and
// DNSM.UnqCardzCol under Stuff2("CardsCollected") in the Collection Cashout source) stay on the page: they sit inside the call of their source, which `traceTree` keeps
// because it leads to a flagged note, exactly as the other trackers show theirs; any that did not would be listed under the root.
//
// The recombination guard rebuilds the total from the tree with the page's own Biggest Gains model (groupedGainsModel over COIN_GROUPS, the vote left out as the page
// does): if the sources no longer give the block's total it throws TreeTotalMismatch, so the tracker reads "incomplete" instead of showing a number the headline does not match.
//
// The type of the result is the page's own (lib/statTracker/config StatResult: type-only).
import type { StatResult } from "@/lib/statTracker/config";
import { groupedGainsModel } from "@/lib/statTracker/biggestGains";
import { COIN_GROUPS, COIN_ROOT, COIN_VOTE_NAME } from "@/lib/coinMulti/layers";
import { groupNote, groupVal } from "@/lib/statTracker/groups";
import { afkTarget } from "../afkTarget";
import { asNum } from "../attr";
import { makeCtx, type Ctx, type TraceNode } from "../ctx";
import { ArbitraryCode } from "../njs/ArbitraryCode";
import { bundleAsNum } from "../njs/Thingies";
import { finishTree, migratedNote, stateOf, takeFrom, type Take } from "./page";

type Node = StatResult["tree"];

/** What a source computes from: `t` takes a call (it must exist), `leaf` shows a number that is no call of its own, `c` reads the save. */
type Ops = { t: Take; leaf: (name: string, val: number, note: string) => number; c: Ctx };
/** One source of the tree: its name, format and note as lib/arkh's tree had them (a function when the note depends on the pass), and `of`, the term as the block uses it (see the header). */
type Source = { name: string; fmt?: "raw"; note?: string | ((c: Ctx, val: number) => string | undefined); of: (o: Ops) => number };

// Offsets (raw N.js): ArbitraryCode "MonsterCash" @4047005
const SOURCES: Record<string, Source> = {
  bubbleSTR: { name: "Penny of Strength (Power Cauldron)", note: "Cash bubble (key CashSTR): +% cash per 250 STR", of: ({ t }) => t("DNSM.AlchBubbles", "CashSTR") * Math.floor(t("TotalStats", "STR") / 250) },
  bubbleAGI: { name: "Dollar of Agility (Quicc Cauldron)", note: "Cash bubble (key CashAGI): +% cash per 250 AGI", of: ({ t }) => t("DNSM.AlchBubbles", "CashAGI") * Math.floor(t("TotalStats", "AGI") / 250) },
  bubbleWIS: { name: "Nickel of Wisdom (High-IQ Cauldron)", note: "Cash bubble (key CashWIS): +% cash per 250 WIS", of: ({ t }) => t("DNSM.AlchBubbles", "CashWIS") * Math.floor(t("TotalStats", "WIS") / 250) },
  comp24: { name: "Cool Bird (Companion 24)", fmt: "raw", of: ({ t }) => t("Companions", 24) },
  comp38: { name: "Balloonfish (Companion 38)", fmt: "raw", of: ({ t }) => t("Stuff2", "CoinDropMulti", 0, 0) - 1 },
  comp45: { name: "Equinox Broadbass (Companion 45)", fmt: "raw", of: ({ t }) => t("Companions", 45) },
  comp159: { name: "Potluck (Companion 159)", fmt: "raw", of: ({ t }) => t("Companions", 159) },
  eventShop9: { name: "Coin Stacking (Event Shop 9)", note: "×0.5 per purchase: 1.5x all coin gain", fmt: "raw", of: ({ t }) => 0.5 * t("Summoning", "EventShopOwned", 9, 0) },
  eventShop20: { name: "Government Subsidy (Event Shop 20)", note: "×0.6 per purchase: 1.6x coins from monsters", fmt: "raw", of: ({ t }) => 0.6 * t("Summoning", "EventShopOwned", 20, 0) },
  etc77: { name: "Bonus Money (Equipment)", note: "EtcBonuses(77) = %_BONUS_MONEY; gear + obols + nametag + trophy + premium hat", of: ({ t }) => t("EtcBonuses", "77") },
  sushi18: { name: "Tobo Twins (Sushi Tier 19) — extra coins dropped by monsters (RoG Bonus 18)", note: "sushi RoG 18", of: ({ t }) => t("SushiStuff", "RoG_BonusQTY", 18, 0) },
  sushi37: { name: "Aji Sashimi (Sushi Tier 38) — extra coins dropped by monsters (RoG Bonus 37)", note: "sushi RoG 37", of: ({ t }) => t("SushiStuff", "RoG_BonusQTY", 37, 0) },
  grid149: { name: "Glimbo Linguistics (Research Grid 149)", note: "Also boosts coins dropped by monsters", of: ({ t }) => t("ResearchStuff", "Grid_Bonus", 149, 0) },
  grid169: { name: "Glimbo BOGO Offer (Research Grid 169)", note: "Also x coin gain", of: ({ t }) => t("ResearchStuff", "Grid_Bonus", 169, 0) },
  etc100: { name: "Extra Money (Equipment)", note: "EtcBonuses(100) = %_EXTRA_MONEY", of: ({ t }) => t("EtcBonuses", "100") },
  goldSet: { name: "Gold Set", of: ({ t }) => t("GetSetBonus", "GOLD_SET", "Bonus", 0, 0) },
  gambit7: { name: "Coins from Monsters (Gambit Bonus 7)", note: "10 × log10(Gambit points); needs the bonus's point requirement", of: ({ t }) => t("Holes", "GambitBonuses", 7, 0) },
  bunY: { name: "Cash Bundle", note: "bun_y: 3000-gem pack with +250% cash from monsters; no in-game title", of: ({ leaf, c }) => 250 * leaf("BundlesReceived.bun_y", bundleAsNum(c, "bun_y"), "Owned") },
  dustWalker: { name: "Dustwalker (Talent 433)", note: "× log10(total dust ever collected) (OLA[362]); talent value floored at 1", of: ({ t, c }) => Math.max(1, t("getbonus2", 1, 433, -1)) * t("getLOG", asNum(c, "OptionsListAccount", 362)) },
  mealCash: { name: "Salad + Bunt Cake (Meals 2 · 31)", note: "MealBonus(\"Cash\"): every meal with the Cash effect", of: ({ t }) => t("MealBonus", "Cash") },
  artifact1: { name: "Maneki Kat (Artifact 1)", note: "× highest character class level", of: ({ t }) => t("Sailing", "ArtifactBonus", 1, 0) },
  roo6: { name: "Fishing Buddy (Poppy Upgrade 6)", note: "Poppy the Kangaroo Mouse upgrade (code name RooBonuses 6)", of: ({ t }) => t("Summoning", "RooBonuses", 6, 0) },
  vote34: { name: COIN_VOTE_NAME, note: "Only counts the week vote 34 wins", of: ({ t }) => t("Summoning", "VotingBonusz", 34, 0) },
  arena5: { name: "1.5x Monster Cash (Pet Arena Bonus 5)", note: "×0.5; unlocks at arena wave 20 (RANDOlist[53][5])", fmt: "raw", of: ({ t }) => 0.5 * t("Breeding", "PetArenaBonus", "0", 5, 0) },
  friend5: { name: "More Coins (Friend Bonus 5)", note: "Friend bonus type 5; scales with account level", of: ({ t }) => t("Thingies", "FriendBonusStatz", 5, 0) },
  arena14: { name: "2x Monster Cash (Pet Arena Bonus 14)", note: "Unlocks at arena wave 175", fmt: "raw", of: ({ t }) => t("Breeding", "PetArenaBonus", "0", 14, 0) },
  statue19: { name: "Pecunia Statue (Statue 19)", note: "÷ 100 (statue % to fraction)", fmt: "raw", of: ({ t }) => t("ArbitraryCode", "StatueBonusGiven19") / 100 },
  mainframe9: { name: "Fungi Finger Pocketer (Mainframe 9)", note: "× ⌊Green Mushroom account kills / 1M⌋ (Death Note)", of: ({ t }) => t("MainframeBonus", 9) },
  vault34: { name: "Recipe for Profit (Vault 34)", note: "× Taskboard recipes unlocked (VaultKillzTotal(8))", of: ({ t }) => t("Summoning", "VaultUpgBonus", 34, 0) * t("Summoning", "VaultKillzTotal", 8, 0) },
  vault37: { name: "Bubble Money (Vault 37)", note: "× Σ min(100, bubble level) (VaultKillzTotal(9))", of: ({ t }) => t("Summoning", "VaultUpgBonus", 37, 0) * t("Summoning", "VaultKillzTotal", 9, 0) },
  pristine16: { name: "Gumball Necklace (Pristine Charm 16)", note: "x money from monsters", of: ({ t }) => t("Ninja", "PristineBon", 16, 0) },
  prayer8: { name: "Jawbreaker (Prayer 8)", of: ({ t }) => t("prayersReal", 8, 0) },
  divMinor3: { name: "Coins Gained (Divinity Minor Bonus 3)", note: "Σ over the linked gods' minor bonus, type 3", of: ({ t }) => t("Divinity", "Bonus_Minor", -1, 3) },
  cropSC4: { name: "Crop Depot: Cash from Mobs (Bonus 4)", note: "+15% per crop found × depot multi; unlocked by \"Science Environmentally Sourced Pencil\" (Emporium 23)", of: ({ t }) => t("FarmingStuffs", "CropSCbonus", 4, 0) },
  talent657: { name: "Cash Money (Talent 657)", of: ({ t }) => t("GetTalentNumber", 1, 657) },
  vialCash: { name: "Dieter Drink (Vial 5)", note: "Vial effect key MonsterCash", of: ({ t }) => t("DNSM.AlchVials", "MonsterCash") },
  etc3: { name: "Money (Equipment)", note: "EtcBonuses(3) = %_MONEY", of: ({ t }) => t("EtcBonuses", "3") },
  card11: { name: "Money Cards (Card Type 11)", of: ({ t }) => t("CardBonusREAL", 11) },
  cardW5b1: { name: "Molti (Card w5b1)", note: "× 7 per card level", of: ({ t }) => 7 * t("RunCodeOfTypeXforThingY", "CardLv", "w5b1") },
  talent22: { name: "Chaching! (Talent 22)", of: ({ t }) => t("GetTalentNumber", 1, 22) },
  flurbo4: { name: "Monster Cash (Flurbo Shop 4)", of: ({ t }) => t("FlurboShop", 4) },
  arcade10: { name: "Cash From Mobs Arcade Bonus (Arcade 10)", of: ({ t }) => t("ArcadeBonus", 10) },
  arcade11: { name: "Cash From Mobs Arcade Bonus (Arcade 11)", of: ({ t }) => t("ArcadeBonus", 11) },
  box13c: { name: "Utilitarian Capsule (Post Office 13c)", note: "% Cash from Mobs (third slot of box 13)", of: ({ t }) => t("DNSM.BoxRewards", "13c") },
  guild8: { name: "Coin Supercharger (Guild 8)", note: "× world number (1 + ⌊map / 50⌋)", of: ({ t, c }) => t("GuildBonuses", 8) * (1 + Math.floor(c.map / 50)) },
  // the map picker's line: the block's TalentCalc(643) read this target for its tier, so a term above 0 cannot throw here
  talent643: { name: "Coins For Charon (Talent 643)", note: (c, val) => (0 < val ? `Map ${c.map} · target ${afkTarget(c)}` : undefined), of: ({ t }) => t("TalentCalc", 643) },
  talent644: { name: "American Tipper (Talent 644)", of: ({ t }) => t("TalentCalc", 644) },
  goldFood: { name: "Golden Bread (Golden Food)", note: "Σ of equipped + Emporium golden foods with effect MonsterCash", of: ({ t }) => t("GoldFoodBonuses", "MonsterCash") },
  vault17: { name: "Mining Payday (Vault 17)", note: "× log10(total ores mined) (OLA[340])", of: ({ t, c }) => t("Summoning", "VaultUpgBonus", 17, 0) * t("getLOG", asNum(c, "OptionsListAccount", 340)) },
  ach235: { name: "Zero G Scorin' (Achievement 235)", note: "× 5", of: ({ t }) => 5 * t("AchieveStatus", 235) },
  ach350: { name: "Valley Visitor (Achievement 350)", note: "× 10", of: ({ t }) => 10 * t("AchieveStatus", 350) },
  ach376: { name: "Summoning Im (Achievement 376)", note: "× 20", of: ({ t }) => 20 * t("AchieveStatus", 376) },
  vault2: { name: "Monster Tax (Vault 2)", of: ({ t }) => t("Summoning", "VaultUpgBonus", 2, 0) },
  vault14: { name: "Bored to Death (Vault 14)", note: "× ⌊log10(Bean kills)⌋, Valley Of The Beans (VaultKillzTotal(4))", of: ({ t }) => t("Summoning", "VaultUpgBonus", 14, 0) * t("Summoning", "VaultKillzTotal", 4, 0) },
  vault31: { name: "Dirty Money (Vault 31)", note: "× ⌊log10(Poop kills)⌋, Poopy Sewers (VaultKillzTotal(7))", of: ({ t }) => t("Summoning", "VaultUpgBonus", 31, 0) * t("Summoning", "VaultKillzTotal", 7, 0) },
  ola420: { name: "Coins from Monsters (Hoops Shop 1)", note: "Level of Hoops shop upgrade 1 (OLA[420])", of: ({ leaf, c }) => leaf("OptionsListAccount[420]", asNum(c, "OptionsListAccount", 420), "Hoops shop level") },
  vault70: { name: "Collection Cashout (Vault 70)", note: "× cards collected", of: ({ t }) => t("Summoning", "VaultUpgBonus", 70, 0) * t("Stuff2", "CardsCollected", 0, 0) },
};

// The page's Biggest Gains model: the guard below recombines the tree with it (the one path for the number).
const MODEL = groupedGainsModel(COIN_ROOT, COIN_GROUPS, { skip: [COIN_VOTE_NAME] });

/**
 * The page's result for the character and map of a traced Ctx (nothing computed on it yet): runs `ArbitraryCode("MonsterCash")` once, then reads the tree
 * out of the call it made. A save the game would not have the keys for (Ruling E) throws what the engine throws (MissingSaveKey...).
 */
export function coinTree(ctx: Ctx): StatResult {
  if (!ctx.trace) throw new Error("Coin Multi: the tree is read from the trace, and this Ctx has none");
  const state = ctx.state;
  const total = ArbitraryCode(ctx, "MonsterCash"); // the one call (TRACKERS.coinMulti, trackers/index.ts)
  const root = ctx.trace;
  const call = root.children.find((n) => n.block === "ArbitraryCode" && "MonsterCash" === n.args[0] && "cached" !== n.note);
  if (!call) throw new Error('Coin Multi: no ArbitraryCode("MonsterCash") call in the trace');
  const plain: Ctx = { ...ctx, trace: null }; // the adapter's own save reads leave nothing in the trace
  const used = new Set<TraceNode>();

  const source = (id: string): Node => {
    const def = SOURCES[id];
    if (!def) throw new Error(`Coin Multi: no source "${id}" in the adapter`);
    const kept: Node[] = [];
    const t = takeFrom(call, used, kept, 'Coin Multi: ArbitraryCode("MonsterCash")', id);
    const leaf = (name: string, val: number, note: string) => (kept.push({ name, val, fmt: "raw", note }), val);
    const val = def.of({ t, leaf, c: plain });
    const note = typeof def.note === "function" ? def.note(plain, val) : def.note;
    return { name: def.name, val, fmt: def.fmt ?? "+", ...(note ? { note } : {}), ...(kept.length ? { children: kept } : {}) };
  };

  const groups: Node[] = COIN_GROUPS.map((g) => {
    const items = g.sources.map(source);
    return { name: g.name, val: groupVal(g, items.map((i) => i.val)), fmt: "x", note: g.note ? `${groupNote(g)} · ${g.note}` : groupNote(g), children: items };
  });

  const migrated = migratedNote(state);
  const tree: Node = { name: COIN_ROOT, val: total, fmt: "x", ...(migrated ? { note: migrated } : {}), children: groups };
  return finishTree(tree, total, MODEL, root, call, used);
}

/** `computeArkhCoinMulti`'s counterpart: the envelope of a save, a character index and the map to compute on. */
export function computeGameCoinMulti(save: unknown, charIdx: number, mapIdx: number): StatResult {
  return coinTree(makeCtx(stateOf(save), { player: charIdx, map: mapIdx, trace: true }));
}
