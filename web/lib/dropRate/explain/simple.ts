// The rows under the remaining sources of the Drop Rate V1 tree (lukScaling, shrine4, arcade27, guild10, postOffice11: box11, win9, tome2, dream10, ach377, ach381, owl4, vote27, vault18, friend3, chip, bunV, ola232, bunP, arcane, statue1, family32, tome7,
// cloud69): each one's number is the game's block's, and the rows are its terms, read from the same blocks and lists. No logic from lib/arkh: only the rows' names, order, formats and notes are V1's, as the page's snapshots and Compare
// are keyed by them. A source the save has not unlocked has no rows (the page shows it at 0); a read the save cannot answer is a noted leaf, never a page error.
import { asNum, asNumber, attr } from "@/lib/game/attr";
import { withPlayer } from "@/lib/game/ctx";
import {
  ArmoryUpg, ChipDesc, ClassAccountBonus, ClassFamilyBonuses, ClassNames, CompanionDB, GuildBonuses, LegendTalents, MONSTERS, NinjaInfo, PostOffUpgradeInfo, RegAchieves, Research, ShrineInfo, UpgradeVault,
} from "@/lib/game/data";
import { hString } from "@/lib/game/hstring";
import { listAt } from "@/lib/game/lists";
import { AchieveStatus } from "@/lib/game/njs/AchieveStatus";
import { ArcaneType } from "@/lib/game/njs/ArcaneType";
import { Companions } from "@/lib/game/njs/Companions";
import { CompLV2 } from "@/lib/game/njs/CompLV2";
import { DNSM_CompanionBon, DNSM_TomeQTYtot } from "@/lib/game/njs/DNSM";
import { Dreamstuff } from "@/lib/game/njs/Dreamstuff";
import { FamilyBonsuesREAL } from "@/lib/game/njs/FamilyBonsuesREAL";
import { GetSetBonus } from "@/lib/game/njs/GetSetBonus";
import { Ninja } from "@/lib/game/njs/Ninja";
import { boxLevel } from "@/lib/game/njs/PostOfficeINFO";
import { ReturnClasses } from "@/lib/game/njs/ReturnClasses";
import { RoyalG } from "@/lib/game/njs/RoyalG";
import { cardStars, RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { Sailing } from "@/lib/game/njs/Sailing";
import { Summoning, summWinBonus } from "@/lib/game/njs/Summoning";
import { activeVote } from "@/lib/game/njs/Summoning2";
import { haveBan, Thingies } from "@/lib/game/njs/Thingies";
import { dropRateLuk, TotalStats } from "@/lib/game/njs/TotalStats";
import { playerCount } from "@/lib/game/player";
import type { ArkhNode } from "../node";
import { gameLabel, gameName, near, outOfStep, safe, title } from "./collections";
import type { Explainer } from "./index";
import { raw, row } from "./talent";

type Table = readonly (readonly unknown[])[];
const cell = (list: unknown, ...at: number[]): unknown => at.reduce<unknown>((a, i) => (a as readonly unknown[])[i], list);

/** "Spirit Reindeer (Companion 27)": the companion's monster name, as the game lists show it. */
const companionLabel = (id: number): string => {
  const name = (MONSTERS as Record<string, { Name?: string }>)[hString(CompanionDB[id][0])]?.Name;
  return name ? `${title(name)} (Companion ${id})` : `Companion ${id}`;
};
/** A companion read as a multiplier: `val` is what its row is worth, the children say whether the account has it. */
const companionRow = (c: Parameters<Explainer>[0], id: number, val: number, note: string): ArkhNode =>
  row(companionLabel(id), val, "x", note, [raw("Owned", DNSM_CompanionBon(c).has(`${id}`) ? 1 : 0), raw("Bonus", val)]);

// ===== LUK Scaling =====

/** `DNSM.DropRateLUK` @4190490: the character's LUK and the curve it goes through (the source's number is the curve; the tracker adds the × 1.4). */
const lukScaling = safe("LUK Scaling", (c, curve) => {
  const luk = TotalStats(c, "LUK");
  const under = 1e3 > luk;
  return [raw("🍀 Total LUK", luk), raw(under ? "Sub-1000 curve" : "Over-1000 curve", curve, under ? `(pow(${luk}+1, 0.37)-1)/40` : `(${luk}-1000)/(${luk}+2500)*0.5+0.297`)];
});

// ===== The additive pool =====

/** `Shrine(4)` @7828132: the shrine's level, what that level gives and the Boss3B card's factor (5% per card level). Nothing while the shrine does not count here. */
const shrine4 = safe("Clover Shrine (Shrine 4)", (c, val) => {
  if (!(0 < val)) return [];
  const level = asNum(c, "ShrineInfo", 4, 3);
  const info = (ShrineInfo as unknown as Table)[4];
  const base = asNumber(info[2]);
  const per = asNumber(info[3]);
  const lv = RunCodeOfTypeXforThingY(c, "CardLv", "Boss3B");
  const step = (level - 1) * per + base;
  const multi = 1 + (5 * lv) / 100;
  if (!near(multi * step, val)) return outOfStep("Clover Shrine (Shrine 4)", val, multi * step);
  return [
    row(`Shrine Level ${level}`, step, "+", `${base} base + ${per}/level`),
    row("Chaotic Chizoar (Card Boss3B)", multi, "x", "+5% shrine effect per card level", 0 < lv ? [raw("Card Qty", asNum(c, "Cards", 0, "Boss3B")), raw("Card Lv", lv), raw("Max Stars", cardStars(c).tiers)] : undefined),
  ];
});

/** `ArcadeBonus(27)` @7881530: the level, the curve's value without the multipliers, the Super / Omega factor and Companion 27's ×2 (which the game gives only at stage 1). */
const arcade27 = safe("Drop Rate Arcade Bonus (Arcade 27)", (c, val) => {
  const level = asNum(c, "ArcadeUpg", 27);
  if (!(0 < level)) return [];
  const maxed = 101 == level ? 2 : 102 == level ? 6 : 1;
  const comp = 1 == Companions(c, 27) ? 2 : 1;
  const note = 102 == level ? "Omega (level 102)" : 101 == level ? "Super (level 101)" : "Not maxed";
  return [
    raw("Level", level),
    raw("Raw Value", val / maxed / comp),
    row("Maxed Bonus", maxed, "x", note),
    companionRow(c, 27, comp, 1 == CompLV2(c, 27) ? "stage 2: game applies no ×2 (checks value == 1)" : "companion 27"),
  ];
});

/** `GuildBonuses(10)` @7763433: the guild points and the curve at them. */
const guild10 = safe("Gold Charm (Guild 10)", (c, val) => {
  const level = asNum(c, "GuildTasks", 0, 10);
  if (!(0 < level)) return [];
  const g = (GuildBonuses as unknown as Table)[10];
  return [raw("Guild Points", level), raw("Formula Result", val, `${hString(g[6])}(${asNumber(g[4])},${asNumber(g[5])},${level})`)];
});

/** `DNSM.BoxRewards("DropRate")`: Post Office box 11's points and the curve at them (PostOffUpgradeInfo[11][1..3]). */
const box11 = safe("Non Predatory Loot Box (Post Office 11)", (c, val) => {
  const points = boxLevel(c, 11);
  if (!(0 < points)) return [];
  const p = (PostOffUpgradeInfo as unknown as Table)[11];
  return [raw("Points Invested", points), raw("Formula Result", val, `${hString(p[3])}(${asNumber(p[1])},${asNumber(p[2])},${points})`)];
});

/** The Winner Bonus `b` row of the Summoning tab: the bucket, 3.5 for the base, the charm, the gem shop and the winners' boosts (`WinBonus` @10927394). */
const win9 = safe("Drop Rate Summoning Win (Summoning 9)", (c, val) => {
  if (!(0 < val)) return [];
  const bucket = summWinBonus(c)[9];
  const pristine = Ninja(c, "PristineBon", 8, 0);
  const gem = asNum(c, "GemItemsPurchased", 11);
  const artifact = Sailing(c, "ArtifactBonus", 32, 0);
  const task = Math.min(10, asNum(c, "Tasks", 2, 5, 4));
  const ach379 = AchieveStatus(c, 379);
  const ach373 = AchieveStatus(c, 373);
  const wb31 = Summoning(c, "WinBonus", 31, 0);
  const emperor = Thingies(c, "EmperorBon", 8, 0);
  const godshard = GetSetBonus(c, "GODSHARD_SET", "Bonus", 0, 0);
  const banI = 50 * Thingies(c, "Have_ban_i", 0, 0);
  const winner = 1 + (artifact + task + ach379 + ach373 + wb31 + emperor + godshard + banI) / 100;
  const charm = 1 + pristine / 100;
  const shop = 1 + (10 * gem) / 100;
  if (!near(3.5 * bucket * charm * shop * winner, val)) return outOfStep("Drop Rate Summoning Win (Summoning 9)", val, 3.5 * bucket * charm * shop * winner);
  const ach = (id: number) => gameLabel("Achievement", id, ((RegAchieves as unknown as Table)[id] ?? [])[0]);
  return [
    raw("Win Bonus Raw", bucket),
    row("Base Multiplier", 3.5, "x"),
    row("Crystal Comb (Pristine 8)", charm, "x", 0 < pristine ? "Equipped" : "Not equipped"),
    row("Gem Shop Bonus", shop, "x", `items=${gem}`),
    row("Winner Multi", winner, "x", undefined, [
      raw("Artifact 32", artifact, `rarity=${asNum(c, "Sailing", 3, 32)}`),
      raw("Task Shop", task),
      raw(ach(379), ach379),
      raw(ach(373), ach373),
      raw("Win Bonus 31", wb31),
      raw("Emperor Bon 8", emperor),
      raw("Godshard Set", godshard),
      ...(0 < banI ? [raw("Bundle ban_i", banI)] : []),
    ]),
  ];
});

/** `TomeBonus` @10911395: the Tome's score, how far it is past the bonus's threshold, the base that gives and the Grimoire / Troll factor. */
const tome = (name: string, unlocked: (c: Parameters<Explainer>[0]) => boolean, from: number, per: number) =>
  safe(name, (c, val) => {
    if (!unlocked(c)) return [raw("Not Unlocked", 0)];
    const score = DNSM_TomeQTYtot(c);
    const scaled = Math.floor(Math.max(0, score - from) / per);
    const grimoire = Summoning(c, "GrimoireUpgBonus", 17, 0);
    const troll = GetSetBonus(c, "TROLL_SET", "Bonus", 0, 0);
    const multi = 1 + (grimoire + troll) / 100;
    return [
      raw("Tome Score", score),
      raw("Scaled", scaled, `floor((pts${from ? `-${from}` : ""})/${per})`),
      raw("Base", val / multi),
      row("Tome Multi", multi, "x", undefined, [raw("Grey Tome Book (Grimoire 17)", grimoire), raw("Troll Set", troll)]),
    ];
  });
const tome2 = tome("Drop Rate Additive (Tome 2)", (c) => 1 == attr(c, "OptionsListAccount", 197), 8e3, 100);
const tome7 = tome("Drop Rate Multi (Tome 7)", (c) => 1 == Summoning(c, "EventShopOwned", 27, 0), 0, 1e3);

/** `5 x Dream[10]` (@4190966): the upgrade's level and what each gives. */
const dream10 = safe("Equinox Symbols (Dream 10)", (c, val) => {
  const level = asNum(c, "Dream", 10);
  return [raw("Dream Upgrade Level", level), raw("Per Level", 0 < level ? val / level : 5)]; // 5: the game's literal, shown while the upgrade has no level
});

/** `6 x AchieveStatus(id)` / `4 x ...`: done or not, and what it gives (the game's literal, `bonus`). */
const achievement = (id: number, bonus: number) =>
  safe(`Achievement ${id}`, (c) =>
    0 < AchieveStatus(c, id) ? [raw("Completed", 1), row("Bonus", bonus, "+")] : [raw("Not completed", 0), row("Would grant", bonus, "+", "once completed")]
  );

/** `OwlBonuses(4)` @10950288: the base, the upgrades bought, Legend 26, Companion 51 and the megafeathers. */
const owl4 = safe("Summoning Owl", (c, val) => {
  const upgrades = asNum(c, "OptionsListAccount", 255);
  const count = Math.max(0, Math.ceil((upgrades - 4) / 6));
  if (!(0 < count)) return [];
  const legend = 1 + Thingies(c, "LegendPTS_bonus", 26, 0) / 100;
  const comp51 = Companions(c, 51);
  const feather = (b: number) => Summoning(c, "OwlMegafeather", b, 0);
  const feathers: [string, number][] = [
    ["Feather 1", 100 * feather(1)],
    ["Feather 3", 100 * feather(3)],
    ["Feather 5", 100 * feather(5)],
    ["Feather 7", 100 * feather(7)],
    ["Feather 9", 100 * Math.min(1, feather(9))],
    ["Feather 9+ (×50 ea)", 50 * Math.max(0, feather(9) - 1)],
  ];
  const all = feathers.reduce((a, [, v]) => a + v, 0);
  const megafeather = 1 + all / 100;
  return [
    raw("Base Per Owl", val / (legend * (1 + comp51) * megafeather * count), "OWL_BASE[4]"),
    raw("Owl Count", count, `OLA[255]=${upgrades}`),
    row(gameLabel("Legend", 26, cell(LegendTalents, 26, 0)), legend, "x", "legend 26"),
    companionRow(c, 51, 1 + comp51, "companion 51"),
    row("Megafeather Bonus", megafeather, "x", `OLA[262]=${asNum(c, "OptionsListAccount", 262)}`, feathers.filter(([, v]) => 0 < v).map(([n, v]) => raw(n, v))),
  ];
});

/** `VotingBonusz(27)` @10953438: only the week this vote is in force; then its base and the voting multi. */
const vote27 = safe("Voting Bonus (DR)", (c, val) => {
  const vote = activeVote(c);
  if (27 != vote) return [raw("Not active vote", 0, `active=${vote}`)];
  const base = asNumber(NinjaInfo[38][Math.round(1 + 3 * 27)]);
  return [raw("Base", base), row("Voting Multi", val / base, "x")];
});

/** `VaultUpgBonus(18)` @10893206: the level, the value per level and the mastery vault's factor (vault 32 below vault 32). */
const vault18 = safe("Drops for Days (Vault 18)", (c) => {
  const mastery = asNum(c, "UpgVault", 32);
  return [
    raw("Level", asNum(c, "UpgVault", 18)),
    raw("Per Level", asNumber((UpgradeVault as unknown as Table)[18][5])),
    ...(0 < mastery ? [row("Mastery", 1 + Summoning(c, "VaultUpgBonus", 32, 0) / 100, "x", undefined, [raw("Mastery Lv", mastery)])] : []),
  ];
});

/** `FriendBonusStatz(3)` @10960432: the last friend within the slots whose stat is 3 (with their level), then the Pet1 (Companion 30) and Companion 44 stage 2 factors on the table. */
const friend3 = safe("Friend Bonus", (c, val) => {
  if (!(0 < val)) return [];
  const list = hString(attr(c, "OptionsListAccount", 476));
  const friends = list.split(";");
  let last: ArkhNode | null = null;
  for (let e = 0, n = Math.min(Thingies(c, "FriendBonusSlots", 0, 0), friends.length) | 0; e < n; e++) {
    const [stat, level, name] = friends[e].split(",");
    if (3 != asNumber(stat)) continue;
    last = row(name || "?", Thingies(c, "FriendBonusQTY", 3, asNumber(level)), "+", undefined, [raw("Score", asNumber(level))]);
  }
  const comp30 = Companions(c, 30);
  const comp44 = CompLV2(c, 44);
  return [
    ...(last ? [last] : []),
    ...(0 < comp30 ? [companionRow(c, 30, 1 + comp30, `companion 30${1 < comp30 ? " — stage 2 (LV2)" : ""}`)] : []),
    ...(0 < comp44 ? [row("Companion 44 — Stage 2 (LV2)", 1 + (25 * comp44) / 100, "x", "+25% Friend Bonus multi")] : []),
  ];
});

// ===== The chip =====

/** `chipBonuses("dr")` @5163283: each lab slot of the character holding a chip of that kind. */
const chip = safe("Lab Chip DR", (c) => {
  const out: ArkhNode[] = [];
  for (let slot = 0; slot < 7; slot++) {
    if (-1 == attr(c, "Lab", 1 + c.player, slot)) continue;
    const index = asNum(c, "Lab", 1 + c.player, slot) | 0;
    const desc = (ChipDesc as unknown as Table)[index];
    if ("dr" === hString(desc[10])) out.push(row(`Slot ${slot} ${gameName(desc[0])}`, asNumber(desc[11]), "+", `chip ${index}`));
  }
  return out;
});

// ===== Post-processing =====

/** A bundle: owned or not (`BundlesReceived`). */
const bundle = (key: string) => safe(key, (c) => [raw(1 == haveBan(c, key) ? "Owned" : "Not owned", haveBan(c, key))]);

/** `OptionsListAccount[232]` (Sneaking Mastery) @4190432: the level, the threshold of 1 and the +0.3 it gives past it. */
const ola232 = safe("Sneaking Completions (Sneaking Mastery)", (c) => {
  const level = asNum(c, "OptionsListAccount", 232);
  return [raw("OLA[232]", level), raw("Threshold", 1, 1 <= level ? "met" : "not met"), raw("Bonus", 0.3)];
});

/** `ArcaneMapMulti_bon(0)` @11087291: the kills on the map, the bonus they give, the cap and the lesser. */
const arcane = safe("Arcane Map Bonus", (c, val) => {
  const kills = asNum(c, "MapBon", c.map, 0);
  return [raw("Map Kills", kills), row("Raw Bonus", ArcaneType(c, "ArcaneMapMulti", kills, 0), "+"), raw("Cap", ArcaneType(c, "ArcaneMapMulti_bonMAX", 0, 0)), row("Capped Bonus", val, "+")];
});

/** `RoyalG("StatueBon", 1)` @11223320: the statue's level, the research base and the step per level, and Armory 45's boost. */
const statue1 = safe("Royal Statue: Drop Rate", (c) => {
  const level = asNum(c, "RoyalG", 0, 1);
  if (!(0 < level)) return [raw("Level", 0, "not built")];
  return [
    raw("Level", level),
    raw("Base", asNumber(cell(Research, 41, 1))),
    raw("Per Level", asNumber(cell(Research, 42, 1)), "× (level − 1)"),
    row(`${gameName(cell(ArmoryUpg, 45, 0))} (Armory 45)`, RoyalG(c, "ArmoryUpgBonus", 45, 0), "+", "% boost to every Royal Statue"),
  ];
});

/** `DNSM.FamBonusQTYs["32"]`: the best Royal Guardian level of the account and the class's curve; what the active character's The Family Guy adds on top is its own row. */
const family32 = safe("Royal Guardian Family Bonus", (c, val) => {
  const cls = 16;
  let best = 0;
  for (let t = 0; t < playerCount(c); t++) {
    const who = withPlayer(c, t);
    if (ReturnClasses(asNum(who, "CharacterClass")).includes(cls)) best = Math.max(best, asNum(who, "Lv0", 0));
  }
  const name = title(String((ClassNames as unknown as readonly unknown[])[cls]));
  const family = (ClassFamilyBonuses as unknown as Table)[cls];
  const curve = FamilyBonsuesREAL(c, cls, 0, best);
  return [
    raw(`Best ${name} Lv`, best, 0 < best ? "max across account" : "no character of this class"),
    raw("Lv Offset", asNumber(cell(ClassAccountBonus, cls, 1))),
    raw("Formula x1", asNumber(family[1])),
    raw("Formula x2", asNumber(family[2])),
    ...(val !== curve ? [row("The Family Guy (Talent 144)", val - curve, "+", "active character's own family bonus × (1 + talent 144 / 100)")] : []),
  ];
});

/** `5 x CloudBonus(69)`: the weekly boss undefeated (1) and what that gives (the game's literal). */
const cloud69 = safe("Megaflesh Collector (Dream Challenge 69)", (c) => [raw("Completed", Dreamstuff(c, "CloudBonus", 69)), raw("Coefficient", 5)]);

export const SIMPLE_EXPLAINERS: Record<string, Explainer> = {
  lukScaling, shrine4, arcade27, guild10, postOffice11: box11, win9, tome2, dream10,
  ach377: achievement(377, 6),
  ach381: achievement(381, 4),
  owl4, vote27, vault18, friend3, chip, ola232, arcane, statue1, family32, tome7, cloud69,
  bunV: bundle("bun_v"),
  bunP: bundle("bun_p"),
};
