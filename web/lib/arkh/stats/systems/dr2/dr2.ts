// ===== DROP RATE V2 SYSTEM =====
// One id per term of N.js _customBlock_TotalStats("Drop_Rarity") (@4188223).
// Each returns what its group consumes (defs/drop-rate-v2.ts owns the shapes
// and the order): a % in pct groups, a factor in mult groups, an amount in add
// groups, the new total in the Cove's replace group.
//
// The terms are the V1 catalog resolvers (the ones defs/drop-rate.ts lists),
// called as they are and renamed here when their name carries jargon. They are
// imported directly, not through getCatalog(): registry.ts imports this file,
// so importing the registry back would be a cycle that leaves `dr2` undefined
// whenever this file loads first.
//
// Where V1 and N.js differ, this follows N.js: EtcBonuses("102") is a term,
// StarSigns.Drop counts only the active signs, VotingBonusz(27) carries
// VotingBonuszMulti, Companions 26 and 160 share one max(1, ·) factor, and the
// Cove replaces the total.

import { node, renamed, renamedDeep, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { DR2_VOTE_NAME } from "../../defs/drop-rate-v2";
import { lukScaling } from "../common/stats";
import { talent } from "../common/talent";
import { postOffice } from "../w2/postOffice";
import { etcBonus } from "../common/etcBonus";
import { alchemy, sigil, vial } from "../w2/alchemy";
import { card, cardSet, cardSingle, caveDropCards } from "../common/cards";
import { starSignBonusReal } from "../common/starSign";
import { guild } from "../common/guild";
import { shrine } from "../w3/construction";
import { prayer } from "../w3/prayer";
import { shiny } from "../w4/breeding";
import { arcade } from "../w2/arcade";
import { companion, compMulti } from "../common/companions";
import { stamp } from "../w1/stamp";
import { dream, cloudBonusSys } from "../w3/equinox";
import { winBonus } from "../w6/summoning";
import { tome } from "../w4/tome";
import { goldenFood } from "../common/goldenFood";
import { achievement } from "../common/achievement";
import { owl } from "../w1/owl";
import { farm } from "../w6/farming";
import { votingBonusz } from "../w2/voting";
import { votingMulti } from "../coin/coin";
import { holes, monumentBonusLabel } from "../w5/hole";
import { grimoire } from "../mc/grimoire";
import { vault } from "../common/vault";
import { emperor } from "../w6/emperor";
import { setBonus } from "../w3/setBonus";
import { friend } from "../common/friend";
import { legendPTS } from "../w7/legend";
import { spelunkShop } from "../w7/spelunking";
import { royalStatue, royalGrade } from "../w7/royalG";
import { grid, chip } from "../w4/lab";
import { bundle } from "../common/bundle";
import { workshop, glimbo } from "../common/wrappers";
import { ola } from "../common/ola";
import { arcaneMap } from "../mc/tesseract";
import { menagerieBoost } from "../w7/menagerie";
import { familyBonus } from "../common/familyBonus";
import { sushiRoG } from "../w7/sushi";
import { jellyRoG } from "../w7/jelly";
import { minehead } from "../w7/minehead";
import { pristine } from "../w5/pristine";
import { cglunkoDR, coveActive } from "./cove";

/** The GetTalentNumber(1, …) talents of the formula: they read the viewed
 *  character's own talents, so the Observed Max collector gates them per class
 *  (the node names keep the "(Talent n)" suffix it matches). Workbench's 328 is
 *  getbonus2(1, 328, -1) — the best over every character — so it isn't one. */
export const DR2_CLASS_TALENTS = [24, 239, 279, 655] as const;

type Resolver = { resolve(id: any, ctx: any, args?: any): ArkhNode };
/** resolver, id, args, then the tracker's name and note when the helper's own
 *  name carries jargon (renamed() at this call site; the helper is untouched). */
type Term = readonly [Resolver, unknown?, unknown[]?, string?, string?];

// One line per N.js term that a catalog resolver computes as is, in game order.
const TERMS: Record<string, Term> = {
  // ── Σ ──────────────────────────────────────────────────────────────────
  talent279: [talent, 279],
  box11: [postOffice, [11, 0]], // BoxRewards.DropRate
  etc2: [etcBonus, 2, undefined, "Drop Rate (Equipment)", "EtcBonuses(2) = %_DROP_RATE"],
  etc102: [etcBonus, 102, undefined, "Drop Chance (Equipment)", "EtcBonuses(102) = %_DROP_CHANCE"],
  bubble: [alchemy, "DROPPIN_LOADS", undefined, "Droppin Loads (Kazam Cauldron)", "AlchBubbles.DropRate (bubble [3][1])"],
  card10: [card, 10],
  talent24: [talent, 24],
  // starSigns: a switch case below (StarSigns.Drop, active signs only)
  guild10: [guild, 10],
  // The helper's name, "Damage / Drop / EXP Set Bonus (Card Set 5)", holds the
  // flat-tree separator " / ".
  cardSet5: [cardSet, 5, undefined, "Card Set 5 (Damage · Drop · EXP)"],
  cardSet6: [cardSet, 6],
  shrine4: [shrine, 4],
  prayer7: [prayer, 7],
  sigil11: [sigil, 11],
  shiny0: [shiny, 0],
  arcade27: [arcade, 27],
  comp3: [companion, 3],
  comp50: [companion, 50],
  stamp: [stamp, "A38", undefined, "Golden Sixes Stamp (Stamp A38)", "StampBonusOfTypeX(\"DropRate\")"],
  talent655: [talent, 655], // × OLA[189], the talent's final-bonus wrap
  // 5·Dream[10]: Dream[2 + i] is Equinox upgrade i (DreamUpg), so this is upgrade 8.
  dream10: [dream, 10, undefined, "Faux Jewels (Equinox Upgrade 8)", "5 × Dream[10], the upgrade's level"],
  win9: [winBonus, 9, undefined, "Drop Rate (Winner Bonus 9)", "Summoning winner bonus 9"],
  tome2: [tome, 2],
  // ── DropRateLUK2 ───────────────────────────────────────────────────────
  mini5a: [cardSingle, "mini5a", [1.5, 10]],
  caveCards: [caveDropCards, undefined, undefined, "Ancient Golem · Crystal Glunko (Card caveC · caveD)", "min(100, 4 × caveC Lv + 6 × caveD Lv)"],
  anni4: [cardSingle, "anni4Event1", [2, 20]],
  luckEvent: [cardSingle, "luckEvent1", [3, 25]],
  goldFood: [goldenFood, "DropRatez", undefined, "Golden Cake · Golden Sugar Cookie (Golden Food)", "Σ of equipped + Emporium golden foods with effect DropRatez"],
  ach377: [achievement, 377, [6]],
  ach381: [achievement, 381, [4]],
  owl4: [owl, 4, undefined, "Super Feather Production (Owl Upgrade 4)", "+% Drop Rate (owl bonus 4)"],
  rank9: [farm, "rank9", undefined, "Drop Rate (Farming Rank Upgrade 9)", "LankRankUpgBonus(9)"],
  hole46: [holes, "upg46", undefined, "Gloomie Lootie (Cavern Upgrade 46)", "+5% Drop Rate per Gloomie Mushroom colony defeated"],
  cropSC7: [farm, "cropSC7", undefined, "Crop Depot: Drop Rate (Bonus 7)", "+1% Drop Rate per crop after 100 (CropSCbonus(7))"],
  grimoire44: [grimoire, 44],
  vault18: [vault, 18],
  meas15: [holes, "meas15"],
  comp22: [companion, 22],
  comp158: [companion, 158],
  hole82: [holes, "upg82", undefined, "Sanctum of LOOT (Cavern Upgrade 82)", "+20% Drop Rate per Sanctum of Ancient Golems cleared"],
  monument: [holes, "monument", undefined, monumentBonusLabel(2, 6), "MonumentROGbonuses(2, 6)"],
  emperor11: [emperor, 11, undefined, "Drop Rate (Emperor Bonus 11)"],
  efaunt: [setBonus, "efaunt", undefined, "Efaunt Set", "Equipment set EFAUNT_SET"],
  exotic59: [farm, "exotic59", undefined, "Pommelion Seed (Exotic Market 59)"],
  friend3: [friend, 3, undefined, "Drop Rate (Friend Bonus 3)", "Friend bonus type 3; scales with account level"],
  legend1: [legendPTS, 1],
  spelunk50: [spelunkShop, 50, undefined, "Golden Hardhat (Spelunk Shop 50)"],
  comp111: [companion, 111],
  // talent239: a switch case below (GetTalentNumber(1,239) × RoyalG("TotalStatz"))
  // ── Σ, after DropRateLUK2 ──────────────────────────────────────────────
  grid173: [grid, 173, undefined, "Divine Design (Research Grid 173)"],
  comp132: [companion, 132],
  // ── post-processing ────────────────────────────────────────────────────
  workbench: [workshop], // 1 + getbonus2(1,328,-1)·getLOG(OLA[139])/100
  arcane: [arcaneMap, undefined, undefined, "Arcane Map Bonus: Drop Rate", "MapBon slot 0 on the selected map (ArcaneMapMulti_bon)"],
  statue1: [royalStatue, 1],
  menagerie24: [menagerieBoost, 24],
  card101: [card, 101],
  family32: [familyBonus, 16], // FamBonusQTYs["32"]
  comp168x: [compMulti, 168, [Infinity, 1, 0.3]], // 1 + .3·Companions(168)
  comp132x: [compMulti, 132, [1.5, 1, 1, 0.2]], // 1 + (min(.5, Companions(132)) + .2·CompLV2(132))
  sushi48: [sushiRoG, 48],
  jelly14: [jellyRoG, 14],
  glimbo: [glimbo, undefined, undefined, "Glimbo Insider Trading Secrets (Research Grid 168)", "Minehead(\"GlimboDRmulti\") = 1 + Grid_Bonus(168, 2)/100 once the grid is level 1"],
  tome7: [tome, 7],
  etc99: [etcBonus, 99, undefined, "Bonus Drop Rate (Equipment)", "EtcBonuses(99) = %_BONUS_DROP_RATE"],
  minehead0: [minehead, 0, undefined, "Total Damage and Drop Rate (Minehead Floor 0)", "Minehead(\"BonusQTY\", 0): Research[20][0] once the Minehead floor passes 0"],
  cloud69: [cloudBonusSys, 69, [5], "Megaflesh Collector (Equinox Challenge 69)", "5 × CloudBonus(69): acquire 10 Megaflesh from Bubba the Seal"],
  pristine3: [pristine, 3, undefined, "Cotton Candy (Pristine Charm 3)", "x Drop Rate"],
  etc91: [etcBonus, 91, undefined, "Drop Rate Multi (Equipment)", "EtcBonuses(91) = %_DROP_RATE_MULTI"],
  vial: [vial, "7drMulto", undefined, "Ship in a Bottle (Vial 84)", "Vial effect key 7drMulto"],
  comp26: [compMulti, 26, [1.3]], // min(1.3, 1 + Companions(26))
  comp160: [compMulti, 160, [Infinity, 2]], // 1 + .5·Companions(160)
  comp50x: [compMulti, 50, [1.01, 2500]], // min(1.01, 1 + Companions(50)/2500)
};

const raw = (name: string, v: number, note?: string): ArkhNode => node(name, v, null, { fmt: "raw", note });

// @njs _customBlock_TotalStats
function resolveDr2(id: string, ctx: SystemCtx): ArkhNode {
  const s = ctx.saveData;
  const ci = ctx.charIdx;
  const t = TERMS[id];
  if (t) {
    const [r, rid, args, name, note] = t;
    const n = r.resolve(rid, ctx, args);
    return name ? renamed(n, name, note) : n;
  }

  switch (id) {
    // 1.4·DropRateLUK sits outside the /100 (PR #27), so as a % of the base
    // group it is 140 × the curve.
    case "luk": {
      const l = lukScaling.resolve(undefined, ctx);
      return node("LUK Scaling (Drop Rate)", 140 * l.val, l.children, { fmt: "+", note: "1.4 × the LUK curve, outside the /100: 140 × curve as %" });
    }
    // StarSigns.Drop: +5 with sign 14 and +12 with sign 76 in StarSignsDL (the
    // equipped signs + the infinite ones), × Seraph. V1's starSign resolver
    // calls the same helper (it only differs in the Seraph row's name).
    case "starSigns": {
      const r = starSignBonusReal("Drop", ci, s);
      return node("Star Signs: Drop Rate", r.val, r.children, { fmt: "+", note: "StarSigns.Drop: Pirate Booty (14), Druipi Major (76), × Seraph" });
    }
    // VotingBonusz(27) = NinjaInfo base × VotingBonuszMulti (V1's resolver
    // leaves the multi at 1); only the week's winning vote counts.
    case "vote27": {
      const multi = votingMulti(ctx);
      return node(DR2_VOTE_NAME, votingBonusz(27, multi, s), [node("Voting multi", multi, null, { fmt: "x" })], { fmt: "+", note: "Only counts the week vote 27 wins" });
    }
    // min(5, total + chipBonuses("dr")/100) while the total is under 5.
    case "chip": {
      const c = chip.resolve("dr", ctx);
      return node("Grounded Processor (Lab Chip 3)", c.val / 100, c.children, { fmt: "+", note: "chipBonuses(\"dr\") ÷ 100, only while the total is under 5; the active character's chips" });
    }
    case "bunV":
      return renamed(bundle.resolve("bun_v", ctx), "Death Bringer Bundle", "bun_v: +2 Drop Rate");
    case "bunP":
      return renamed(bundle.resolve("bun_p", ctx), "Explorer Bundle", "bun_p: ×1.2 Drop Rate");
    // +0.3 once OLA[232] ≥ 1.
    case "ola232": {
      const n = renamedDeep(ola.resolve(232, ctx, [1, 0.3]), (x) => (x === "OLA[232]" ? ["Sneaking Mastery level", "OLA[232]"] : undefined));
      return renamed(n, "Sneaking Mastery", "+0.3 once OLA[232] ≥ 1");
    }
    // The helper's child repeats the talent's name; the parent keeps the
    // "(Talent 239)" suffix class gating matches.
    case "talent239": {
      const n = renamedDeep(royalGrade.resolve(239, ctx), (x) => (x === "Graded Rate (Talent 239)" ? ["Talent value"] : undefined));
      return renamed(n, "Graded Rate (Talent 239)", "× total resource-node grades (RoyalG TotalStatz)");
    }
    // 216 == CurrentMap && 17 == Holes[0][char] → Holes2("Cglunko_DR"). Always
    // emitted: 0 keeps the total (replace takes only a value > 0).
    case "cove": {
      const map = ctx.mapIdx ?? 0;
      const on = coveActive(s, ci, map);
      const cove = cglunkoDR(s);
      return node("Crystal Glunko Cove", on ? cove : 0, [
        raw("The character's cavern", Number((s.holesData as any)?.[0]?.[ci]) || 0, "Holes[0][char]"),
        raw("Cove Drop Rate", cove, "Holes2(\"Cglunko_DR\")"),
      ], { fmt: "x", note: `Map 216 (The Hole), cavern 17 (The Cove): replaces the whole Drop Rate${on ? "" : " · inactive: not map 216 in cavern 17"}` });
    }
    default:
      throw new Error(`dr2: unknown source "${id}"`);
  }
}

export const dr2 = { resolve: resolveDr2 };
