// ===== DAMAGE SYSTEM =====
// One id per term of N.js _customBlock_DamageDealed("Max") (@4105019 in the
// 2026-11-01 N.js), in game order. defs/damage.ts owns the shapes (L0 Σ, the
// L1/L2 products, the three soft caps, the Reliquarium exponent, the map-43
// replacement) and the order. Each source returns what its group consumes: the
// term for add/pct groups, the ready factor (1 + x/100, or the N.js factor) for
// mult groups, the exponent for the Reliquarium (0 = off), the replacement for
// the map-43 arena (0 elsewhere).
//
// The terms are the old derived-damage computeMaxDamage's (same helpers, same
// 0-on-throw reads), each wired to the port that already lives in its own
// system (Task 4 ported the last four: divinity blessings 7/8, eclipse
// skulls, Killroy, sticker). Buff 108 is 0: an active buff, not in the save.
//
// Resolvers are imported directly, not through getCatalog(): registry.ts
// imports this file. derived-damage.ts holds the shared inputs and must not
// import this file back.

import { node, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { getLOG } from "../../../formulas";
import { ITEMS } from "../../data/game/items.js";
import { AlchemyDescription, AtomInfo, GodsInfo, GrimoireUpg, RANDOlist } from "../../data/game/customlists.js";
import { charClassData, divinityData, dreamData, emmData, equipOrderData, optionsListData } from "../../../save/data";
import { entityName, label } from "../../entity-names";
import damageDesc, { dmgMax, type ValsOf } from "../../defs/damage";
import {
  computeBoxReward,
  computeCardBonusByType,
  computeFamBonusQTYs,
  computeMealBonus,
  computeStatueBonusGiven,
  computeTotalStat,
} from "../common/stats";
import { computePlayerHPmax, computePlayerMPmax } from "../common/derived-stats";
import {
  safe,
  rval,
  gtn,
  computeStarSignBonus,
  damageStatType,
  computeWeaponPower,
  computePlayerSpeed,
  talentCalcTerms,
  greenSigilDmgPct,
  mapDamageDivisor,
  foodBoostMulti,
} from "../common/derived-damage";
import { vaultKillzTotal } from "../coin/accountKills";
import { rooBonus } from "../coin/roo";
import { divinityMinorFor } from "../coin/divinityMinor";
import { bubbaRoGBonus } from "../exp/bubba";
import { compassBonus } from "../exp/compass";
import { msaTotalWaves } from "../exp/msa";
import { saltLick } from "../exp/saltLick";
import { totalFoodBonuses } from "../exp/food";
import { riftSkillETC, eclipseSkulls, killroyDmg } from "../w4/rift";
import { farm, cropSCbonMulti, stickerDmgMulti } from "../w6/farming";
import { cglunkoUpgBon } from "../dr2/cove";
import { fountainBonusTotal } from "../../data/w5/fountain";
import { talent } from "../common/talent";
import { etcBonus } from "../common/etcBonus";
import { vault } from "../common/vault";
import { companion } from "../common/companions";
import { friend } from "../common/friend";
import { goldFoodBonuses } from "../common/goldenFood";
import { computeCardSetBonus, computeCardLv } from "../common/cards";
import { achieveStatus } from "../common/achievement";
import { computeStampBonusOfTypeX } from "../w1/stamp";
import { owl } from "../w1/owl";
import { arcade } from "../w2/arcade";
import { sigil, bubbleValByKey, computeVialByKey } from "../w2/alchemy";
import { votingBonusz } from "../w2/voting";
import { getBribeBonus } from "../w3/bribe";
import { getSetBonus } from "../w3/setBonus";
import { computeShrine } from "../w3/construction";
import { computeAllShimmerBonuses } from "../w3/equinox";
import { computePrayerReal } from "../w3/prayer";
import { tome } from "../w4/tome";
import { computeShinyBonusS } from "../w4/breeding";
import { mainframeBonus, chipBonuses } from "../w4/lab";
import { pristine } from "../w5/pristine";
import { divinityBlessBonus } from "../w5/divinity";
import { computeCosmoBonus, computeMonumentROGbonus } from "../w5/hole";
import { computeArtifactBonus } from "../w5/sailing";
import { computeSummUpgBonus, winBonus } from "../w6/summoning";
import { grimoireUpgBonus } from "../mc/grimoire";
import { computePaletteBonus, shopUpgBonus } from "../w7/spelunking";
import { computeMeritocBonusz } from "../w7/meritoc";
import { mineheadBonusQTY } from "../w7/minehead";
import { rogBonusQTY, computeUniqueSushi } from "../w7/sushi";
import { exoticBonusQTY } from "../../data/w5/farming";
import { jellyRoGBonus } from "../../data/w7/jelly";
import { royalStatueBon, armoryUpgBonus } from "../../data/w7/royalG";
import { superBitType, emporiumBonus } from "../../../game-helpers";

/** GetTalentNumber(1|2, …) talents the block reads on the viewed character,
 *  each surfaced as a "(Talent n)" node: the Observed Max collector gates them
 *  per class (deriveGatedTalentsFor drops the account-wide and universal ones).
 *  getbonus2(1, …, -1) — 508/208 (Workbench), 507, 50 — is the best over every
 *  character, so it isn't one. 113/123 include the Mastery reads. */
export const DMG_CLASS_TALENTS = [
  95, 455, 20, 97, 277, 457, 5, 113, 86, 446, 284, 463, 31, 110, 125, 485, 305, 470, 290, 656, 649, 638, 658, 6, 24,
  123,
] as const;

const raw = (name: string, v: number, note?: string): ArkhNode => node(name, v, null, { fmt: "raw", note });
const pct = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "+", note });
const factor = (name: string, v: number, children?: ArkhNode[] | null, note?: string): ArkhNode =>
  node(name, v, children ?? null, { fmt: "x", note });

type Resolver = { resolve(id: any, ctx: any, args?: any): ArkhNode };
type Read = { v: number; kids?: ArkhNode[] | null };
/** rval()'s read (0 when it throws) plus the resolver's own breakdown. */
function res(r: Resolver, id: unknown, ctx: unknown, args?: unknown): Read {
  try {
    const n = r.resolve(id, ctx, args);
    return { v: n.val || 0, kids: n.children };
  } catch {
    return { v: 0 };
  }
}
/** safe()'s read plus the helper's own breakdown when it returns a tree. */
function sn(fn: (...a: any[]) => any, ...args: any[]): Read {
  let kids: ArkhNode[] | null = null;
  const v = safe((...a: any[]) => {
    const r = fn(...a);
    if (r && typeof r === "object" && Array.isArray(r.children)) kids = r.children;
    return r;
  }, ...args);
  return { v, kids };
}

/** "Name (Bubble W6)" from AlchBubbles' key (AlchemyDescription[c][i][15]). */
function bubbleName(key: string): string {
  const alch = AlchemyDescription as any[];
  for (let c = 0; c < 4; c++) {
    const i = (alch[c] ?? []).findIndex((b: any) => b && b[15] === key);
    if (i >= 0) {
      const name = entityName("bubble", `${c},${i}`);
      return name ? `${name} (Bubble ${key})` : `Bubble ${key}`;
    }
  }
  return `Bubble ${key}`;
}

// Inputs several sources read (STAT, WP, HP/MP, speed, TalentCalc, family
// bonuses, the four stats): computed once per ctx — one tree build, or one
// computeMaxDamage call (which builds its own ctx), as the old inline code did.
// Keyed by the ctx object: a ctx must not be mutated after its first use.
const sharedMemo = new WeakMap<SystemCtx, Map<string, unknown>>();
function once<T>(ctx: SystemCtx, key: string, fn: () => T): T {
  let m = sharedMemo.get(ctx);
  if (!m) sharedMemo.set(ctx, (m = new Map()));
  if (!m.has(key)) m.set(key, fn());
  return m.get(key) as T;
}
const statTypeOf = (ctx: SystemCtx) => once(ctx, "stat", () => damageStatType(ctx.charIdx, ctx));
const wpOf = (ctx: SystemCtx) => once(ctx, "wp", () => computeWeaponPower(ctx.charIdx, ctx));
const hpOf = (ctx: SystemCtx) =>
  once(ctx, "hp", () => {
    try {
      return Math.max(1, computePlayerHPmax(ctx.charIdx, ctx).val || 250);
    } catch {
      return 250;
    }
  });
const mpOf = (ctx: SystemCtx) =>
  once(ctx, "mp", () => {
    try {
      return Math.max(1, computePlayerMPmax(ctx.charIdx, ctx).val || 150);
    } catch {
      return 150;
    }
  });
const speedOf = (ctx: SystemCtx) => once(ctx, "spd", () => computePlayerSpeed(ctx.charIdx, ctx));
const tcOf = (ctx: SystemCtx) => once(ctx, "tc", () => talentCalcTerms(ctx.charIdx, ctx));
const famOf = (ctx: SystemCtx, i: number): number => {
  const fam = once(ctx, "fam", () => computeFamBonusQTYs(ctx.charIdx, ctx.saveData));
  return fam && typeof fam === "object" ? Number((fam as any)[i]) || 0 : 0;
};
const statsOf = (ctx: SystemCtx) =>
  once(ctx, "stats", () => {
    const t = (k: string) => computeTotalStat(k, ctx.charIdx, ctx).computed;
    return { STR: t("STR"), AGI: t("AGI"), WIS: t("WIS"), LUK: t("LUK") };
  });

// Achievement weights of the L2 "(1 + (… + achievements)/100)" group, N.js order.
const ACH_WEIGHTS: readonly [number, number][] = [
  [58, 2], [59, 3], [60, 5], [62, 5], [119, 2], [120, 3], [121, 5], [189, 4], [185, 2], [186, 3], [187, 5],
  [240, 1], [280, 1], [297, 3], [303, 2], [364, 2], [354, 4], [375, 3],
];

// @njs _customBlock_DamageDealed
// @njs Max
function resolveDamage(id: string, ctx: SystemCtx): ArkhNode {
  const s = ctx.saveData;
  const ci = ctx.charIdx;
  const ola = (i: number) => Number((optionsListData as any)[i]) || 0;
  const div25 = () => Number(divinityData && (divinityData as any)[25]) || 0;
  const talentPct = (n: number, args?: unknown, note?: string): ArkhNode => {
    const r = res(talent, n, ctx, args);
    return pct(label("Talent", n), r.v, r.kids, note);
  };
  const helperPct = (name: string, r: Read, note?: string): ArkhNode => pct(name, r.v, r.kids, note);
  const helperFactor = (name: string, r: Read, note?: string): ArkhNode =>
    factor(name, 1 + r.v / 100, [pct("Bonus %", r.v, r.kids)], note ?? "1 + x/100");

  switch (id) {
    // ── L0: Base Damage — Σ, the soft cap, then the food after it ──
    // N.js ((TotalStats("Weapon_Power")·(1 + (GTN 97 + GTN 277 + GTN 457 +
    // Holes("CosmoBonusQTY",2,4))/100) + GTN 5)/3)².
    case "wpSquared": {
      const wpRaw = wpOf(ctx);
      const t97 = rval(talent, 97, ctx);
      const t277 = rval(talent, 277, ctx);
      const t457 = rval(talent, 457, ctx);
      const cosmo = safe(computeCosmoBonus, 2, 4, s);
      const t5 = rval(talent, 5, ctx);
      const wp = wpRaw * (1 + (t97 + t277 + t457 + cosmo) / 100) + t5;
      return pct(
        "Weapon Power²",
        Math.pow(wp / 3, 2),
        [
          raw("Weapon Power", wpRaw, 'TotalStats("Weapon_Power")'),
          pct(label("Talent", 97), t97),
          pct(label("Talent", 277), t277),
          pct(label("Talent", 457), t457),
          pct("Cosmo Bonus (Holes 2, 4)", cosmo),
          raw(label("Talent", 5), t5, "added after the %"),
        ],
        "((WP × (1 + Σ%/100) + Talent 5) / 3)²"
      );
    }
    // N.js DamageDealtSTATtype = TotalStats(primary stat) × (1 + (GTN 95 +
    // GTN 455 + GTN 20 + W6 + A6 + M6)/100).
    case "statType": {
      const st = statTypeOf(ctx);
      return pct(
        "Primary Stat",
        st.val,
        [
          raw("Primary stat total", st.statVal, `TotalStats("${st.stat}")`),
          pct(label("Talent", 95), st.t95),
          pct(label("Talent", 455), st.t455),
          pct(label("Talent", 20), st.t20),
          pct(bubbleName("W6"), st.W6),
          pct(bubbleName("A6"), st.A6),
          pct(bubbleName("M6"), st.M6),
        ],
        "DamageDealtSTATtype: stat × (1 + Σ/100); other classes' bubbles count 0"
      );
    }
    // N.js GoldFoodBonuses("BaseDamage").
    case "goldFoodBase": {
      let v = 0;
      try {
        const gf = goldFoodBonuses("BaseDamage", ci, undefined as any, s);
        v = gf && typeof gf === "object" ? Number((gf as any).total) || 0 : Number(gf) || 0;
      } catch {}
      return pct("Golden Food (Base Damage)", v);
    }
    // N.js Math.min(150, 2·TotalStats("Weapon_Power") + DamageDealtSTATtype).
    case "statWpFloor": {
      const wpRaw = wpOf(ctx);
      const st = statTypeOf(ctx).val;
      return pct(
        "Weapon Power + Stat (max 150)",
        Math.min(150, 2 * wpRaw + st),
        [raw("Weapon Power", wpRaw), raw("Primary Stat", st)],
        "min(150, 2 × WP + stat)"
      );
    }
    // N.js ArcadeBonus(0).
    case "arcade0":
      return helperPct(label("Arcade", 0), res(arcade, 0, ctx));
    // N.js Summoning("OwlBonuses",1).
    case "owl1":
      return helperPct(label("Owl", 1), res(owl, 1, ctx));
    // N.js Summoning("VaultUpgBonus",0).
    case "vault0":
      return helperPct(label("Vault", 0), res(vault, 0, ctx));
    // N.js VaultUpgBonus(20) × VaultKillzTotal(5).
    case "vault20": {
      const v = rval(vault, 20, ctx);
      const k = safe(vaultKillzTotal, 5, s);
      return pct(label("Vault", 20), v * k, [raw("Vault bonus", v), raw("Vault kills (5)", k, "⌊log10(account kills on map 24)⌋")]);
    }
    // N.js StampBonusOfTypeX("BaseDmg").
    case "stampBaseDmg":
      return helperPct("Base Damage Stamps", sn(computeStampBonusOfTypeX, "BaseDmg", s), 'StampBonusOfTypeX("BaseDmg")');
    // N.js EtcBonuses("16").
    case "etc16":
      return helperPct("Base Damage (Equipment)", res(etcBonus, "16", ctx), "EtcBonuses(16)");
    // N.js ArbitraryCode("StatueBonusGiven0").
    case "statue0":
      return helperPct("Power Statue (Statue 0)", sn(computeStatueBonusGiven, 0, ci, s));
    // N.js BoxRewards.basedmg.
    case "boxBaseDmg":
      return helperPct("Base Damage (Post Office)", sn(computeBoxReward, ci, "basedmg"), "BoxRewards.basedmg");
    // N.js AlchBubbles.bdmgHP × getLOG(max(PlayerHPmax() − 250, 1)).
    case "bubbleHP": {
      const b = safe(bubbleValByKey, "bdmgHP", ci, s);
      const hp = hpOf(ctx);
      return pct(bubbleName("bdmgHP"), b * getLOG(Math.max(hp - 250, 1)), [raw("Bubble", b), raw("Max HP", hp)], "× log10(max(HP − 250, 1))");
    }
    // N.js AlchBubbles.bdmgSPD × Log2(max(PlayerSpeedBonus() − .1, 0))/.25.
    case "bubbleSPD": {
      const b = safe(bubbleValByKey, "bdmgSPD", ci, s);
      const spd = speedOf(ctx);
      return pct(bubbleName("bdmgSPD"), b * (Math.log2(Math.max(spd - 0.1, 0)) / 0.25), [raw("Bubble", b), raw("Move speed", spd)], "× log2(max(speed − 0.1, 0)) / 0.25");
    }
    // N.js AlchBubbles.bdmgMP × getLOG(max(PlayerMPmax() − 150, 1)).
    case "bubbleMP": {
      const b = safe(bubbleValByKey, "bdmgMP", ci, s);
      const mp = mpOf(ctx);
      return pct(bubbleName("bdmgMP"), b * getLOG(Math.max(mp - 150, 1)), [raw("Bubble", b), raw("Max MP", mp)], "× log10(max(MP − 150, 1))");
    }
    // N.js CardBonusREAL(4).
    case "card4":
      return helperPct("Base Damage Cards (Card Type 4)", sn(computeCardBonusByType, 4, ci, s));
    // N.js Labb("SigilBonus","Blank",4).
    case "sigil4":
      return helperPct("Sigil 4", res(sigil, 4, ctx));
    // N.js RunCodeOfTypeXforThingY("CardLv","fallEvent2") (2026-10-22).
    case "cardFallEvent2":
      return pct("Card fallEvent2 level", safe(computeCardLv, "fallEvent2", s), null, 'CardLv("fallEvent2")');
    // N.js Σ over the FoodSlotsOwned food with Effect "BaseDmgBoosts" (not
    // Blank, quantity ≠ 0) of Amount × FoodBonuses("BaseDmgBoostsEffectBonus"),
    // added after the cap. The multiplier is the same for every such food.
    // @njs _customBlock_FoodBonuses
    case "foodBaseDmg": {
      const amt = safe(totalFoodBonuses, "BaseDmgBoosts", ci, s);
      const m = foodBoostMulti(ci, ctx);
      return pct("Base Damage Food", amt * m, [raw("Food Amount", amt), factor("Food effect bonus", m)], "Σ Amount × food effect bonus");
    }

    // ── L1: Damage % — (1 + Σ/100) × smithing × win × talents × golden food, soft cap ──
    // N.js Math.pow(DamageDealtSTATtype, .7).
    case "statPow": {
      const st = statTypeOf(ctx).val;
      return pct("Primary Stat^0.7", Math.pow(st, 0.7), [raw("Primary Stat", st)], "DamageDealtSTATtype^0.7");
    }
    // N.js VaultUpgBonus(27) × VaultKillzTotal(6).
    case "vault27": {
      const v = rval(vault, 27, ctx);
      const k = safe(vaultKillzTotal, 6, s);
      return pct(label("Vault", 27), v * k, [raw("Vault bonus", v), raw("Vault kills (6)", k, "⌊log10(account kills on map 13)⌋")]);
    }
    // N.js VaultUpgBonus(15) × OLA[338].
    case "vault15": {
      const v = rval(vault, 15, ctx);
      return pct(label("Vault", 15), v * ola(338), [raw("Vault bonus", v), raw("OLA[338]", ola(338))]);
    }
    // N.js .4 × VaultUpgBonus(10).
    case "vault10": {
      const v = rval(vault, 10, ctx);
      return pct(label("Vault", 10), 0.4 * v, [raw("Vault bonus", v)], "× 0.4");
    }
    // N.js GetBribeBonus("30") / ("20").
    case "bribe30":
    case "bribe20": {
      const n = id.slice(5);
      return helperPct(`Bribe ${n}`, sn(getBribeBonus, n, s));
    }
    // N.js StampBonusOfTypeX("PctDmg").
    case "stampPctDmg":
      return helperPct("Damage % Stamps", sn(computeStampBonusOfTypeX, "PctDmg", s), 'StampBonusOfTypeX("PctDmg")');
    // N.js FarmingStuffs("LankRankUpgBonus",14) (w6/farming.ts).
    case "lankRank14":
      return helperPct("Land Rank 14", res(farm, "rank14", ctx), "LankRankUpgBonus(14)");
    // N.js ArbitraryCode("StatueBonusGiven22").
    case "statue22":
      return helperPct("Statue 22", sn(computeStatueBonusGiven, 22, ci, s));
    // N.js GetTalentNumber(1,113) (read wrapped, as before).
    case "talent113":
      return talentPct(113);
    // N.js getLOG(PlayerHPmax()) × GTN(1,86) / getLOG(PlayerMPmax()) × GTN(1,446).
    case "talent86":
    case "talent446": {
      const n = id === "talent86" ? 86 : 446;
      const max = n === 86 ? hpOf(ctx) : mpOf(ctx);
      const t = gtn(n, ctx);
      const lg = getLOG(Math.max(max, 1));
      return pct(label("Talent", n), lg * t, [raw("Talent Value", t), raw(n === 86 ? "Max HP" : "Max MP", max)], `× log10(${n === 86 ? "HP" : "MP"})`);
    }
    // N.js Summoning("OwlBonuses",2).
    case "owl2":
      return helperPct(label("Owl", 2), res(owl, 2, ctx));
    // N.js Summoning("RooBonuses",4): coefficient 2 (coin.ts).
    case "roo4":
      return helperPct("Roo Bonus 4", sn(rooBonus, 4, 2, s), "RooBonuses(4), coefficient 2");
    // N.js Bubbastuff("BubbaRoG_Bonuses",4) (exp/bubba.ts).
    case "bubbaRoG4":
      return pct("Bubba RoG Bonus 4", safe(bubbaRoGBonus, 4, s));
    // N.js VaultUpgBonus(80).
    case "vault80":
      return helperPct(label("Vault", 80), res(vault, 80, ctx));
    // N.js Spelunk("ShopUpgBonus",64): SpelunkUpg[64][4] × level (64 has no
    // post-fix in SpelunkyUpgTOT).
    case "spelunkShop64":
      return pct("Spelunk Shop 64", safe(shopUpgBonus, 64, s));
    // N.js 1 + GTN(1,284)·(min(100, Lv0[2])/10)/100 (read wrapped, as before).
    case "talent284": {
      const t = rval(talent, 284, ctx);
      const smith = Number((s.lv0AllData as any)?.[ci]?.[2]) || 0;
      return pct(label("Talent", 284), t * (Math.min(100, smith) / 10), [raw("Talent", t), raw("Smithing level", smith, "max 100")], "× min(100, smithing LV) / 10");
    }
    // N.js Summoning("WinBonus",0).
    case "win0":
      return helperPct("Damage (Winner Bonus 0)", res(winBonus, 0, ctx));
    // N.js GTN(2,463) × ⌊MinigameHiscores[0]/25⌋.
    case "talent463": {
      const t = gtn(463, ctx, { tab: 2 });
      let hs = 0;
      try {
        const arr = (s as any).minigameHiscores || ((s as any).data && (s as any).data.FamValMinigameHiscores);
        if (arr) hs = Number(arr[0]) || 0;
      } catch {}
      return pct(label("Talent", 463), t * Math.floor(hs / 25), [raw("Talent Value", t), raw("Minigame high score", hs)], "× ⌊score / 25⌋");
    }
    // N.js AlchBubbles.W12 / A12 / M12.
    case "bubbleW12":
    case "bubbleA12":
    case "bubbleM12": {
      const key = id.slice(6);
      return helperPct(bubbleName(key), sn(bubbleValByKey, key, ci, s));
    }
    // N.js TalentCalc(31) + TalentCalc(110) + GTN(1,125)·TalentCalc(125) +
    // TalentCalc(485) + TalentCalc(305)/50 + TalentCalc(470)/10 + TalentCalc(656)
    // (talentCalcTerms, computed once).
    case "tc31":
    case "tc110":
    case "tc125":
    case "tc485":
    case "tc305":
    case "tc470":
    case "tc656": {
      const n = Number(id.slice(2));
      return pct(label("Talent", n), tcOf(ctx)[n], null, "TalentCalc: talent × its counter");
    }
    // N.js Holes("B_UPG",57).
    // @njs B_UPG
    case "bUpg57": {
      const h9 = (s.holesData as any) && (s.holesData as any)[9];
      const h13 = (s.holesData as any) && (s.holesData as any)[13];
      // Kept as ported: `(x) || 0 > 0` parses as `(x) || false`.
      const v = (h13 && Number(h13[57])) || 0 > 0 ? 20 * Math.floor(getLOG(Number(h9 && h9[1]) || 1)) : 0;
      return pct("The Hole B_UPG 57", v, null, "20 × ⌊log10(Holes[9][1])⌋ once bought");
    }
    // N.js GTN(1,290) × ⌊min(PlayerSpeedBonus() − 1, 10)/.15⌋.
    case "talent290": {
      const t = gtn(290, ctx);
      const spd = speedOf(ctx);
      return pct(label("Talent", 290), t * Math.floor(Math.min(spd - 1, 10) / 0.15), [raw("Talent Value", t), raw("Move speed", spd)], "× ⌊min(speed − 1, 10) / 0.15⌋");
    }
    // N.js getLOG(OLA[161]) × GTN(1,649) / getLOG(OLA[71]) × GTN(1,638).
    case "talent649":
    case "talent638": {
      const n = id === "talent649" ? 649 : 638;
      const o = n === 649 ? 161 : 71;
      const t = gtn(n, ctx);
      return pct(label("Talent", n), getLOG(ola(o)) * t, [raw("Talent Value", t), raw(`OLA[${o}]`, ola(o))], `× log10(OLA[${o}])`);
    }
    // N.js min(TotalQuestsComplete, GTN(1,658)) (read wrapped, as before).
    case "talent658": {
      const t = rval(talent, 658, ctx);
      const quests = Number((s as any).totalQuestsComplete) || 0;
      return pct(label("Talent", 658), Math.min(quests, t), [raw("Talent", t), raw("Quests completed", quests)], "min(quests, talent)");
    }
    // N.js Divinity("Bonus_Minor", GetPlayersUsernames.indexOf(UserInfo[0]), 7):
    // this character's single-player branch (coin/divinityMinor.ts).
    case "divMinor7":
      return pct("Divinity Minor Link 7", safe(divinityMinorFor, ci, 7, s), null, 'Divinity("Bonus_Minor", this character, 7)');
    // N.js × GoldFoodBonuses("Damage") (1 + total/100).
    case "goldFoodDmg": {
      let total = 0;
      let f = 1;
      try {
        const gfd = goldFoodBonuses("Damage", ci, undefined as any, s);
        total = gfd && typeof gfd === "object" ? Number((gfd as any).total) || 0 : Number(gfd) || 0;
        f = 1 + total / 100;
      } catch {}
      return factor("Golden Food (Damage)", f, [pct("Bonus %", total)], "1 + x/100");
    }

    // ── L2: Damage Multipliers — the factors in N.js order, soft cap, post-cap factors ──
    // N.js WorkbenchStuff("AdditionExtraDMG"): (1 + getbonus2(1,508,-1)·getLOG(OLA[152])/100)
    // × (1 + getbonus2(1,208,-1)·getLOG(OLA[329])/100), at least 1.
    // @njs _customBlock_WorkbenchStuff
    case "workbench": {
      const t508 = gtn(508, ctx, { mode: "max", tab: 1 });
      const t208 = gtn(208, ctx, { mode: "max", tab: 1 });
      let wb = (1 + (t508 * getLOG(ola(152))) / 100) * (1 + (t208 * getLOG(ola(329))) / 100);
      if (wb < 1) wb = 1;
      return factor(
        "Workbench (Extra Damage)",
        wb,
        [raw(label("Talent", 508), t508, "× log10(OLA[152]); best character"), raw(label("Talent", 208), t208, "× log10(OLA[329]); best character")],
        'WorkbenchStuff("AdditionExtraDMG")'
      );
    }
    // N.js 1 + AlchVials["7dmg"]/100.
    case "vial7dmg":
      return helperFactor("Damage Vial (7dmg)", sn(computeVialByKey, "7dmg", s));
    // N.js 1 + RiftStuff("eclipseSkulls")/100 (w4/rift.ts).
    case "eclipse":
      return helperFactor("Eclipse Skulls (Death Note)", sn(eclipseSkulls, s), "+5% per eclipse skull (over 1e9 kills of a World 1–6 Death Note monster, Rift 20)");
    // N.js 1 + GamingStatType("PaletteBonus",34)/100.
    case "palette34":
      return helperFactor("Palette 34", sn(computePaletteBonus, 34, s));
    // N.js 1 + Dream[6]/10.
    case "dream6": {
      const d = Number(dreamData && (dreamData as any)[6]) || 0;
      return factor("Equinox Upgrade 4", 1 + d / 10, [raw("Dream[6]", d)], "1 + Dream[6]/10 (Dream[2 + i] is upgrade i)");
    }
    // N.js 1 + Ninja("PristineBon",0)/100.
    case "pristine0":
      return helperFactor("Pristine Charm 0", res(pristine, 0, ctx));
    // N.js 1 + Summoning("SummUpgBonus",79)/100.
    case "summUpg79":
      return helperFactor("Summoning Upgrade 79", sn(computeSummUpgBonus, 79, s, ci));
    // N.js 1 + Holes2("Cglunko_upgBon",19)/100 (dr2/cove.ts).
    case "cglunko19":
      return helperFactor("Crystal Glunko Upgrade 19", sn(cglunkoUpgBon, 19, s));
    // N.js GetBuffBonuses(108,2): a buff, only while it's active (not in the save).
    case "buff108":
      return pct("Buff 108 (active buff only)", 0, null, "active buff only");
    // N.js Thingies("FriendBonusStatz",0).
    case "friend0":
      return helperPct("Friend Bonus (Damage)", res(friend, 0, ctx));
    // N.js DNSM.StarSigns.PctDmg.
    case "starSignPctDmg":
      return pct("Star Signs (Damage %)", computeStarSignBonus("PctDmg", ci, s));
    // N.js max(0, Divinity[25] − 10) × getbonus2(1,507,-1).
    case "divinity507": {
      const t = rval(talent, 507, ctx, { mode: "max", tab: 1 });
      return pct(label("Talent", 507), Math.max(0, div25() - 10) * t, [raw("Talent", t, "best character"), raw("Divinity[25]", div25())], "× max(0, Divinity[25] − 10)");
    }
    // N.js ⌊max(0, Lv0[0] − 200)/50⌋ × getbonus2(1,50,-1).
    case "level50": {
      const t = rval(talent, 50, ctx, { mode: "max", tab: 1 });
      const lv = Number((s.lv0AllData as any)?.[ci]?.[0]) || 0;
      return pct(label("Talent", 50), Math.floor(Math.max(0, lv - 200) / 50) * t, [raw("Talent", t, "best character"), raw("Character level", lv)], "× ⌊max(0, LV − 200) / 50⌋");
    }
    // N.js Summoning("GrimoireUpgBonus",35).
    case "grimoire35":
      return helperPct("Grimoire Upgrade 35", sn(grimoireUpgBonus, 35, GrimoireUpg, s));
    // N.js GetSetBonus("LUSTRE_SET").
    case "lustreSet":
      return helperPct("Lustre Set", sn(getSetBonus, "LUSTRE_SET"));
    // N.js Shrine(0): computeShrine, the reader Max HP's Shrine(1) uses (shrine.resolve only knows shrine 4).
    // computeShrine skips N.js's Shrine gate (Artifact 0 owned, or the current map is the
    // shrine's, or MF5 on and the same world, @7828132), as afk.ts's Shrine(8) already does:
    // it counts a shrine as always active.
    // @njs _customBlock_Shrine
    case "shrine0":
      return helperPct(label("Shrine", 0), sn(computeShrine, 0, s));
    // N.js Holes("MonumentROGbonuses",0,6).
    case "monument06":
      return helperPct("Monument Bonus (0, 6)", sn(computeMonumentROGbonus, 0, 6, s));
    // N.js BoxRewards["12c"] / ["21c"] / ["23c"].
    case "box12c":
    case "box21c":
    case "box23c": {
      const k = id.slice(3);
      return helperPct(`Post Office ${k}`, sn(computeBoxReward, ci, k), `BoxRewards["${k}"]`);
    }
    // N.js FamBonusQTYs["20"].
    case "fam20":
      return pct("Family Bonus 20", famOf(ctx, 20));
    // N.js Sailing("ArtifactBonus",25 | 2 | 8 | 27 | 29).
    // Gap: Artifact 8 lacks N.js's getLOG(Σ WorkbenchStuff("PlayerBuildSpd") over every
    // character) factor (@7814745), so computeArtifactBonus returns base × tier for it.
    case "artifact25":
    case "artifact2":
    case "artifact8":
    case "artifact27":
    case "artifact29": {
      const n = Number(id.slice(8));
      return pct(`Artifact ${n}`, safe(computeArtifactBonus, n, ci, ctx));
    }
    // N.js AtomCollider("AtomBonuses",9): Atoms[9] × AtomInfo[9][4] (inline port).
    // @njs AtomBonuses
    case "atom9": {
      const lv = Number((s.atomsData as any) && (s.atomsData as any)[9]) || 0;
      const per = Number((AtomInfo as any)[9] && (AtomInfo as any)[9][4]) || 0;
      return pct("Atom 9", lv * per, [raw("Atom level", lv), raw("Per level", per)]);
    }
    // N.js Breeding("ShinyBonusS","Nah",5).
    case "shiny5":
      return pct("Shiny Pets (Breeding 5)", safe(computeShinyBonusS, 5, s));
    // N.js GamingStatType("MSA_Bonus",0): SuperBitType(7) ? ⌊_GenINFO[114]/10⌋ : 0.
    // exp/msa.ts ports only slot 4; slot 0 reads the same wave total.
    // @njs MSA_Bonus
    case "msa0": {
      const waves = safe(msaTotalWaves, s);
      const on = safe(superBitType, 7, (s.gamingData as any)?.[12]) === 1;
      return pct("MSA Bonus 0", on ? Math.floor(waves / 10) : 0, [raw("Total Worship waves", waves), raw("Super Bit 7", on ? 1 : 0)], "⌊waves / 10⌋ once Super Bit 7 is owned");
    }
    // N.js OLA[178] × Dreamstuff("AllShimmerBonuses").
    case "shimmer178": {
      const sh = safe(computeAllShimmerBonuses, s);
      return pct("Shimmer Bonuses", ola(178) * sh, [raw("OLA[178]", ola(178)), raw("All shimmer bonuses", sh)]);
    }
    // N.js FarmingStuffs("CropSCbonus",0): Emporium 27 → 20 × round(crops found)
    // × CropSCbonMulti (the depot multi in w6/farming.ts; Coin's cropSC4 shape).
    // @njs CropSCbonus
    case "cropSC0": {
      const on = emporiumBonus(27, (s.ninjaData as any)?.[102]?.[9]) === 1;
      const crops = Math.round(Number(s.farmCropCount) || 0);
      const multi = safe(cropSCbonMulti, s);
      return pct("Crop Scientist 0", on ? 20 * crops * multi : 0, [raw("Emporium 27 unlocked", on ? 1 : 0), raw("Crops found", crops), factor("Depot multi", multi)], "20 × crops found × depot multi");
    }
    // N.js VaultUpgBonus(41) × getLOG(OLA[346]).
    case "vault41": {
      const v = rval(vault, 41, ctx);
      return pct(label("Vault", 41), v * getLOG(ola(346)), [raw("Vault bonus", v), raw("OLA[346]", ola(346))], "× log10(OLA[346])");
    }
    // N.js RiftStuff("RiftSkillETC",0) (w4/rift.ts).
    case "riftEtc0":
      return pct("Rift Skill Bonus 0", safe(riftSkillETC, 0, s), null, "7 + 5 per skill past mastery rank 2 (Rift 15)");
    // N.js AlchBubbles.pctDmg1 / pctDmg2 / pctDmg3.
    case "pctDmg1":
    case "pctDmg2":
    case "pctDmg3":
      return helperPct(bubbleName(id), sn(bubbleValByKey, id, ci, s));
    // N.js AlchBubbles.W5·⌊max(STR, LUK)/250⌋ + A5·⌊AGI/250⌋ + M5·⌊WIS/250⌋; the
    // class's own bubble only (warrior < 18, archer < 30, mage).
    case "bubbleW5":
    case "bubbleA5":
    case "bubbleM5": {
      const key = id.slice(6);
      const cls = Number(charClassData && (charClassData as any)[ci]) || 0;
      const own = key === "W5" ? cls < 18 : key === "A5" ? cls >= 18 && cls < 30 : cls >= 30;
      const b = safe(bubbleValByKey, key, ci, s);
      const st = statsOf(ctx);
      const stat = key === "W5" ? Math.max(st.STR, st.LUK) : key === "A5" ? st.AGI : st.WIS;
      const statName = key === "W5" ? "max(STR, LUK)" : key === "A5" ? "AGI" : "WIS";
      return pct(
        bubbleName(key),
        (own ? 1 : 0) * b * Math.floor(stat / 250),
        [raw("Bubble", b), raw(statName, stat), raw("Own class", own ? 1 : 0)],
        `× ⌊${statName} / 250⌋`
      );
    }
    // N.js WorkbenchStuff("ConstMasteryBonus",1): Rift[0] ≥ 40 →
    // max(0, 2·⌊(Σ tower levels − 750)/10⌋) (inline port).
    // @njs ConstMasteryBonus
    case "constMastery1": {
      let v = 0;
      try {
        const rift = Number((s.riftData as any) && (s.riftData as any)[0]) || 0;
        if (rift >= 40) {
          const tow = (s as any).towerData;
          if (tow && tow.length > 26) {
            let lv = 0;
            for (let i = 0; i < 27; i++) lv += Number(tow[i]) || 0;
            v = Math.max(0, 2 * Math.floor((lv - 750) / 10));
          }
        }
      } catch {}
      return pct("Construction Mastery 1", v, null, "Rift ≥ 40: 2 × ⌊(Σ tower levels − 750) / 10⌋");
    }
    // N.js Summoning("TomeBonus",0).
    case "tome0":
      return helperPct("Tome Bonus 0", res(tome, 0, ctx));
    // N.js Windwalker("CompassBonus",48) (exp/compass.ts).
    case "compass48":
      return pct("Compass Bonus 48", safe(compassBonus, 48, s));
    // N.js FarmingStuffs("ExoticBonusQTY",41) — Briar Patch.
    case "exotic41":
      return pct("Exotic Crop 41", safe(exoticBonusQTY, 41, s));
    // N.js OLA[419] / OLA[435].
    case "ola419":
    case "ola435":
      return pct(`OLA[${id.slice(3)}]`, ola(Number(id.slice(3))));
    // N.js GetTalentNumber(1,6) (read wrapped, as before).
    case "talent6":
      return talentPct(6);
    // N.js SaltLick(9) (exp/saltLick.ts).
    case "saltLick9":
      return pct("Salt Lick 9", safe(saltLick, 9, s));
    // N.js EtcBonuses("45").
    case "etc45":
      return helperPct("Damage % (Equipment)", res(etcBonus, "45", ctx), "EtcBonuses(45)");
    // N.js prayersReal(15,0).
    case "prayer15":
      return helperPct(label("Prayer", 15), sn(computePrayerReal, 15, 0, ci, s));
    // N.js MainframeBonus(0) / (11) / (110).
    case "mainframe0":
    case "mainframe11":
    case "mainframe110": {
      const n = Number(id.slice(9));
      return pct(`Lab Mainframe ${n}`, safe(mainframeBonus, n, s));
    }
    // N.js Holes("B_UPG",84,100): Holes[11][55] × 100 once bought.
    // @njs B_UPG
    case "bUpg84": {
      const h11 = (s.holesData as any) && (s.holesData as any)[11];
      const on = (((s.holesData as any) && (s.holesData as any)[13] && Number((s.holesData as any)[13][84])) || 0) > 0;
      const v = ((h11 && Number(h11[55])) || 0) > 0 && on ? 100 * Number(h11[55]) : 0;
      return pct("The Hole B_UPG 84", v, null, "100 × Holes[11][55] once bought");
    }
    // N.js ArcadeBonus(46).
    case "arcade46":
      return helperPct(label("Arcade", 46), res(arcade, 46, ctx));
    // N.js Companions(10) / (156).
    case "comp10":
    case "comp156": {
      const n = Number(id.slice(4));
      return helperPct(label("Companion", n), res(companion, n, ctx));
    }
    // N.js CardBonusREAL(42).
    case "card42":
      return helperPct("Damage Cards (Card Type 42)", sn(computeCardBonusByType, 42, ci, s));
    // N.js CardSetBonuses(0,"5").
    case "cardSet5":
      return helperPct("Card Set 5 (Damage · Drop · EXP)", sn(computeCardSetBonus, ci, "5"));
    // N.js 20 × Breeding("PetArenaBonus",2) / 40 × (…,15) = CalcTalentMAP.arena > n,
    // arena = how many RANDOlist[53] waves in a row the best wave (OLA[89])
    // has reached. (exp/petArenaCruc.ts is the Crucible's twin; Coin inlines
    // its own two bonuses.)
    // @njs PetArenaBonus
    case "petArena2":
    case "petArena15": {
      const n = Number(id.slice(8));
      const w = n === 2 ? 20 : 40;
      const reqs = ((RANDOlist as any[])[53] ?? []) as unknown[];
      let arena = 0;
      while (arena < 16 && ola(89) >= Number(reqs[arena])) arena++;
      return pct(
        `Pet Arena ${n}`,
        arena > n ? w : 0,
        [raw("Best arena wave", ola(89), "OLA[89]"), raw("Arena waves reached", arena)],
        `${w} once more than ${n} arena waves are reached`
      );
    }
    // N.js chipBonuses("dmg").
    case "chipDmg":
      return pct("Lab Chips (Damage)", safe(chipBonuses, "dmg", ci), null, 'chipBonuses("dmg")');
    // N.js MealBonus("TotDmg").
    case "mealTotDmg":
      return helperPct("Meals (Total Damage)", sn(computeMealBonus, "TotDmg", s));
    // N.js 2·AchieveStatus(58) + 3·(59) + … + 3·(375): 18 achievements.
    case "achievements": {
      const kids = ACH_WEIGHTS.map(([n, w]) => pct(label("Achievement", n), w * safe(achieveStatus, n, s), null, `× ${w}`));
      return pct("Achievements", kids.reduce((a, k) => a + k.val, 0), kids);
    }
    // N.js Divinity("BlesssBonus",7) / (…,8) (w5/divinity.ts): Flutterbis' and
    // Kattlekruk's blessings, Divinity[35] / Divinity[36].
    case "bless7":
    case "bless8": {
      const b = Number(id.slice(5));
      return pct(
        `${(GodsInfo as any)[b][0]} Blessing (God ${b})`,
        safe(divinityBlessBonus, b, s),
        [raw("Blessing level", Number((divinityData as any)?.[28 + b]) || 0, `Divinity[${28 + b}]`)],
        'Divinity("BlesssBonus", ' + b + ")"
      );
    }
    // N.js max((1 − GTN(1,24)/100)·(1 − GetBuffBonuses(124,2)/100)·max(.01, 1 −
    // (prayersReal(6,1) + prayersReal(13,1))/100), .05).
    case "penalty": {
      const t24 = rval(talent, 24, ctx);
      const p6 = safe(computePrayerReal, 6, 1, ci, s);
      const p13 = safe(computePrayerReal, 13, 1, ci, s);
      const v = Math.max((1 - t24 / 100) * 1 * Math.max(0.01, 1 - (p6 + p13) / 100), 0.05);
      return factor(
        "Damage Penalties",
        v,
        [
          pct(label("Talent", 24), t24),
          pct("Buff 124 (active buff only)", 0, null, "active buff only"),
          pct(`Curse: ${label("Prayer", 6)}`, p6),
          pct(`Curse: ${label("Prayer", 13)}`, p13),
        ],
        "max((1 − T24/100) × (1 − buff/100) × max(0.01, 1 − curses/100), 0.05)"
      );
    }
    // N.js 1 + Minehead BonusQTY(0)/100.
    case "minehead0": {
      const floor = ((s as any).stateR7 && (s as any).stateR7[4]) || 0;
      return factor("Minehead Bonus 0", 1 + safe(mineheadBonusQTY, 0, floor) / 100, [raw("Mine floor", floor)], "1 + x/100");
    }
    // N.js 1 + WepPowDmgPCT/100: Minehead bonus 4 × the weapon's Weapon_Power
    // (item + its affix).
    case "wepPowDmg": {
      const floor = ((s as any).stateR7 && (s as any).stateR7[4]) || 0;
      let v = 0;
      try {
        const b4 = mineheadBonusQTY(4, floor);
        if (b4 > 0) {
          const eo = equipOrderData && (equipOrderData as any)[ci];
          const weapon = eo && eo[0] && eo[0][1];
          const base = weapon && (ITEMS as any)[weapon] ? (ITEMS as any)[weapon].Weapon_Power || 0 : 0;
          const em0 = emmData && (emmData as any)[ci] && (emmData as any)[ci][0];
          const affix = em0 && em0[1] ? Number(em0[1].Weapon_Power) || 0 : 0;
          v = b4 * (base + affix);
        }
      } catch {}
      return factor("Weapon Power Damage (Minehead 4)", 1 + v / 100, [pct("Bonus %", v)], "Minehead bonus 4 × the weapon's Weapon Power");
    }
    // N.js 1 + Jelly RoG 37/100.
    case "jelly37":
      return factor("Jelly RoG 37", 1 + safe(jellyRoGBonus, 37, s) / 100);
    // N.js 1 + RoyalStatue(0)/100.
    case "royalStatue0":
      return factor("Royal Statue 0", 1 + safe(royalStatueBon, 0, s as any) / 100);
    // @njs CoralKidUpgBonus — (1 + CoralKidUpgBonus(11)/100)^max(0, Divinity[25] − 35); Coral Kid 11 = round(OLA[621]).
    case "coralKid11": {
      const ck = Math.round(Number((optionsListData as any)[621]) || 0);
      return factor("Coral Kid 11", Math.pow(1 + ck / 100, Math.max(0, div25() - 35)), [raw("Coral Kid 11", ck, "round(OLA[621])"), raw("Divinity[25]", div25())], "(1 + x/100)^max(0, Divinity[25] − 35)");
    }
    // N.js 1 + min(150, WeeklyBoss.g)/100, when WeeklyBoss has "g".
    case "weeklyBoss": {
      let f = 1;
      try {
        const wbg = (s as any).weeklyBossData;
        if (wbg && wbg.g != null) f = 1 + Math.min(150, Number(wbg.g) || 0) / 100;
      } catch {}
      return factor("Weekly Boss", f, null, "1 + min(150, g)/100");
    }
    // N.js × 0.5 when QuestComplete.Cactolyte3 == 0, CharacterClass == 2 and
    // _ItemsOwnedMap.Quest47 ≥ 1 (the Elderly Peanut). _ItemsOwnedMap is the
    // character's InventoryOrder summed by name over ItemQuantity.
    case "cactolyte": {
      const inv = (s.inventoryOrderData as any)?.[ci] ?? {};
      const qty = (s.itemQtyData as any)?.[ci] ?? {};
      let peanuts = 0;
      for (const k of Object.keys(inv)) if (inv[k] === "Quest47") peanuts += Number(qty[k]) || 0;
      const q = (s.questCompleteData as any)?.[ci]?.Cactolyte3;
      const open = q != null && Number(q) === 0;
      const cls = Number(charClassData && (charClassData as any)[ci]) || 0;
      return factor(
        "Cactolyte quest (Elderly Peanut)",
        open && cls === 2 && peanuts >= 1 ? 0.5 : 1,
        [raw("Elderly Peanuts carried", peanuts), raw("Cactolyte3 in progress", open ? 1 : 0), raw("Class", cls)],
        "× 0.5 while class 2 carries the Elderly Peanut on Cactolyte3"
      );
    }
    // N.js 1 + EtcBonuses("72" | "75" | "104")/100.
    case "etc72":
    case "etc75":
    case "etc104": {
      const n = id.slice(3);
      return helperFactor(`Damage (Equipment ${n})`, res(etcBonus, n, ctx), `EtcBonuses(${n})`);
    }
    // N.js 1 + VotingBonusz(1,1)/100.
    case "voting1":
      return helperFactor("Voting Bonus 1", sn(votingBonusz, 1, 1, s));
    // N.js 1 + Holes2("Fountain_BonTOT",1,16)/100: Swingy O' Sword (data/w5/fountain.ts).
    // @njs Fountain_BonTOT
    // @njs _customBlock_Holes2
    case "fountain16":
      return helperFactor("Fountain 16", sn(fountainBonusTotal, s, 1, 16), "1 + Fountain_BonTOT(1,16)/100");
    // N.js 1 + Sushi RoG 49/100.
    case "sushi49": {
      const u = (s as any).cachedUniqueSushi || safe(computeUniqueSushi, (s as any).sushiData);
      return factor("Sushi RoG 49", 1 + safe(rogBonusQTY, 49, u) / 100, [raw("Unique sushi", u)], "1 + x/100");
    }
    // N.js 1 + .1 × SuperBitType(64).
    case "superBit64": {
      const b = safe(superBitType, 64, (s.gamingData as any) && (s.gamingData as any)[12]);
      return factor("Super Bit 64", 1 + 0.1 * b, [raw("Owned", b)], "1 + 0.1 × bit");
    }
    // N.js 1 + 10·⌊(96 + OLA[232])/100⌋/100.
    case "ola232": {
      const v = 10 * Math.floor((96 + ola(232)) / 100);
      return factor("OLA[232]", 1 + v / 100, [raw("OLA[232]", ola(232))], "1 + 10 × ⌊(96 + OLA[232]) / 100⌋ / 100");
    }
    // N.js 1 + CardBonusREAL(96)/100.
    case "card96":
      return helperFactor("Damage Cards (Card Type 96)", sn(computeCardBonusByType, 96, ci, s));
    // N.js max(1, FarmingStuffs("StickerDMGmulti")) (w6/farming.ts).
    case "sticker":
      return factor("Sticker Damage (Grid 47)", Math.max(1, safe(stickerDmgMulti, s)), null, "1 + Grid 47 × stickers found / 100, once Grid 47 is unlocked");
    // N.js 1 + (TomeBonus(6) + AchieveStatus(371) + AchieveStatus(384))/100.
    case "tome6": {
      let t6 = 0;
      try {
        t6 = tome.resolve(6, ctx as any).val || 0;
      } catch {}
      const a371 = safe(achieveStatus, 371, s);
      const a384 = safe(achieveStatus, 384, s);
      return factor("Tome Bonus 6 & Achievements", 1 + (t6 + a371 + a384) / 100, [pct("Tome Bonus 6", t6), pct(label("Achievement", 371), a371), pct(label("Achievement", 384), a384)], "1 + Σ/100");
    }
    // N.js 1 + max(0, min(2, RiftStuff("KillroyDMG")/100)) (w4/rift.ts).
    case "killroy": {
      const k = safe(killroyDmg, s);
      return factor("Killroy Damage", 1 + Math.max(0, Math.min(2, k / 100)), [pct("Bonus %", k)], "1 + min(200, ⌊(Σ best Killroy kills)^0.4⌋)/100");
    }
    // N.js max(1, (1+C12)(1+C33)(1+2·C160)(1+.5·C168)(1+C170)) (@4123746).
    case "companions": {
      const c = (n: number) => rval(companion, n, ctx);
      const c12 = c(12);
      const c33 = c(33);
      const c160 = c(160);
      const c168 = c(168);
      const c170 = c(170);
      const v = Math.max(1, (1 + c12) * (1 + c33) * (1 + 2 * c160) * (1 + 0.5 * c168) * (1 + c170));
      return factor(
        "Companions",
        v,
        [raw(label("Companion", 12), c12), raw(label("Companion", 33), c33), raw(label("Companion", 160), c160, "× 2"), raw(label("Companion", 168), c168, "× 0.5"), raw(label("Companion", 170), c170)],
        "max(1, Π(1 + c))"
      );
    }
    // N.js 1 + min(1.5·CardLv("Crystal6"), 15)/100.
    case "crystal6": {
      const lv = safe(computeCardLv, "Crystal6", s);
      return factor("Crystal6 Card", 1 + Math.min(1.5 * lv, 15) / 100, [raw("Card level", lv)], "1 + min(1.5 × LV, 15)/100");
    }
    // N.js 1 + MeritocBonusz(5)/100.
    case "meritoc5":
      return factor("Meritocracy 5", 1 + safe(computeMeritocBonusz, 5, s) / 100);
    // N.js 1 + min(100, TotalGreenSigils · Grid_Bonus(127))/100 (2026-11-01).
    case "greenSigils":
      return factor("Eclectic Sigils (Research Grid 127)", 1 + safe(greenSigilDmgPct, s) / 100, null, "1 + min(100, sigils × grid 127)/100");
    // N.js × 1.5 when BundlesReceived.bon_a == 1.
    case "bundleA": {
      let owned = false;
      try {
        const bun = (s as any).bundlesData || ((s as any).data ? (s as any).data.BundlesReceived : (s as any).BundlesReceived);
        owned = !!(bun && bun.bon_a == 1);
      } catch {}
      return factor("Damage Bundle (bon_a)", owned ? 1.5 : 1, [raw("Owned", owned ? 1 : 0)]);
    }
    // N.js 1 + FamBonusQTYs["80"]/100.
    case "fam80": {
      const v = famOf(ctx, 80);
      return factor("Family Bonus 80", 1 + v / 100, [pct("Bonus %", v)], "1 + x/100");
    }
    // N.js L2^(4/(5 + OLA[473])) when Thingies("ReliquariumInPosession") == 1:
    // "Quest105" in the character's InventoryOrder. The exponent is the source.
    // @njs ReliquariumInPosession
    case "reliquarium": {
      const owned = Object.values((s.inventoryOrderData as any)?.[ci] ?? {}).includes("Quest105");
      return node("Reliquarium", owned ? 4 / (5 + ola(473)) : 0, [raw("Carried", owned ? 1 : 0), raw("OLA[473]", ola(473))], {
        fmt: "raw",
        note: "exponent 4/(5 + OLA[473]) while carrying the Unstable Reliquarium",
      });
    }
    // N.js L2 / 100^Menagerie[5][2] when CurrentMap == 306 (The Clamworks).
    case "map306": {
      const d = mapDamageDivisor(ctx.mapIdx ?? -1, s);
      return factor("Clamworks (map 306)", 1 / d, [raw("Divisor", d, "100^Menagerie[5][2]")], "1 / 100^Menagerie[5][2] on map 306");
    }

    // ── Map 43: RoyalG("RatDMG") replaces Max ──
    // N.js (10 + ArmoryUpgBonus(35)) × (1 + ArmoryUpgBonus(36)/100) when CurrentMap == 43.
    // @njs RatDMG
    case "ratDmg": {
      const name = "Rat Damage (Royal Guardian arena)";
      if (ctx.mapIdx !== 43) return raw(name, 0, "map 43 only");
      const a35 = safe(armoryUpgBonus, 35, s);
      const a36 = safe(armoryUpgBonus, 36, s);
      return node(name, (10 + a35) * (1 + a36 / 100), [raw("Armory 35", a35), pct("Armory 36", a36)], {
        fmt: "raw",
        note: "(10 + Armory 35) × (1 + Armory 36/100)",
      });
    }

    // ── Mastery (Min = Max × Mastery): min(.8, .35 − GTN(2,113)/100 +
    // (AlchBubbles.Mastery + CardBonusREAL(21) + GTN(1,123) + EtcBonuses("21"))/100) ──
    case "talent113b": {
      const t = gtn(113, ctx, { tab: 2 });
      return pct(`${label("Talent", 113)} · Mastery`, -t, [raw("Talent Value", t, "GetTalentNumber(2,113)")], "subtracted");
    }
    case "bubbleMastery":
      return helperPct(bubbleName("Mastery"), sn(bubbleValByKey, "Mastery", ci, s));
    case "card21":
      return helperPct("Mastery Cards (Card Type 21)", sn(computeCardBonusByType, 21, ci, s));
    case "talent123":
      return pct(label("Talent", 123), gtn(123, ctx), null, "GetTalentNumber(1,123)");
    case "etc21":
      return helperPct("Mastery (Equipment)", res(etcBonus, "21", ctx), "EtcBonuses(21)");

    default:
      throw new Error(`damage: unknown source "${id}"`);
  }
}

export const damage = { resolve: resolveDamage };

// Every pool of the descriptor (layers' groups, the Reliquarium pow, mastery, rat).
const POOLS: [string, string[]][] = Object.entries(damageDesc.pools).map(([k, srcs]) => [k, srcs.map((x) => String(x.id))]);
const valsMemo = new WeakMap<SystemCtx, Record<string, number[]>>();

/** Every source's value by pool key, resolved once per ctx. */
export function damageValsOf(ctx: SystemCtx): ValsOf {
  let vals = valsMemo.get(ctx);
  if (!vals) {
    vals = {};
    for (const [k, ids] of POOLS) vals[k] = ids.map((id) => Number(resolveDamage(id, ctx).val));
    valsMemo.set(ctx, vals);
  }
  const v = vals;
  return (key) => v[key] ?? [];
}

/** N.js DamageDealed("Max") for the character: dmgMax over the system's
 *  sources. `mapIdx` undefined → the map rules (map 43, map 306) stay neutral,
 *  the map-independent Max (ruling A); the page passes its map. */
export function computeMaxDamage(
  charIdx: number,
  ctx: { saveData: any; charIdx?: number; activeCharIdx?: number },
  mapIdx?: number
): number {
  if (!ctx || !ctx.saveData) return 0;
  const ci = charIdx ?? ctx.charIdx ?? 0;
  const max = dmgMax(damageValsOf({ ...ctx, charIdx: ci, mapIdx }));
  return max === max ? max : 0;
}
