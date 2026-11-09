// The rows under the cards, companions, food and the small account sources of the Drop Rate V1 tree (card10, card101, mini5a, anni4, luckEvent, comp3, comp50, comp22, comp158, comp111, comp132, comp132x, comp168x, comp26, comp160, comp50x,
// goldFood, stampA38, bubble, starSigns, prayer7, shiny0, sigil11): each one's number is the game's block's, and the rows are its terms, read from the same blocks and lists. No logic from lib/arkh: only the rows' names, order, formats and
// notes are V1's, as the page's snapshots and Compare are keyed by them. A source the save has not unlocked has no rows (the page shows it at 0); a read the save cannot answer is a noted leaf, never a page error.
import { asNum, asNumber } from "@/lib/game/attr";
import type { Ctx } from "@/lib/game/ctx";
import { AtomInfo, CardStuff, CompanionDB, CompassUpg, IDforCardBonus, LegendTalents, MarketExoticInfo, MONSTERS, Number2Letter, NjEQ, PetStats, Research as ResearchLists, StarSigns } from "@/lib/game/data";
import { hString } from "@/lib/game/hstring";
import { bubbleParts } from "@/lib/game/njs/CauldronStats";
import { equippedCards } from "@/lib/game/njs/CardBonusREAL";
import { CompLV2 } from "@/lib/game/njs/CompLV2";
import { DNSM_CompanionBon, DNSM_CompanionLVz } from "@/lib/game/njs/DNSM";
import { goldFoodMulti, goldFoodParts } from "@/lib/game/njs/GoldFoodBonuses";
import { sigilParts } from "@/lib/game/njs/Labb";
import { MainframeBonus } from "@/lib/game/njs/MainframeBonus";
import { Ninja } from "@/lib/game/njs/Ninja";
import { prayerParts } from "@/lib/game/njs/prayersReal";
import { RunCodeOfTypeXforThingY, cardStars } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { shinyPets } from "@/lib/game/njs/Breeding";
import { activeStarSigns, seraphTerms, seraphUnlocked } from "@/lib/game/njs/StarSigns";
import { stampTerm } from "@/lib/game/njs/StampBonusOfTypeX";
import { stampLevel } from "@/lib/game/njs/StampOverLevel";
import { stampDoublerTerms } from "@/lib/game/njs/Windwalker";
import { Thingies } from "@/lib/game/njs/Thingies";
import type { ArkhNode } from "../node";
import type { Explainer } from "./index";
import { jellyRow } from "./world67";
import { NOT_READ, present, raw, row } from "./talent";

type Table = readonly (readonly unknown[])[];
export const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

/** A source's rows, or one leaf saying why the save could not give them. */
export const safe =
  (name: string, make: (c: Ctx, val: number) => ArkhNode[]): Explainer =>
  (c, val) => {
    try {
      return make(c, val);
    } catch (e) {
      return [{ name, val: 0, note: `${NOT_READ}${e instanceof Error ? e.message : String(e)}` }];
    }
  };

/** The rows are out of step with the number the tracker made (a constant of the game's expression moved): one noted leaf, never rows that do not add up. */
export const outOfStep = (name: string, val: number, expected: number): ArkhNode[] => [{ name, val: 0, note: `${NOT_READ}the rows give ${expected}, the block ${val}: the game's constants changed` }];

// ===== Names, as the game lists show them =====

const SMALL_WORDS = new Set(["of", "the", "a", "an", "and", "in", "for", "to"]);
/** "GRADED_RATE" -> "Graded Rate": a codename in capitals, title-cased. */
const codename = (s: string): string =>
  s
    .split("_")
    .filter(Boolean)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
/** A name from a game list as the game shows it: "_" is a space, minus the "_製" info marker and the "$" slot. */
export const gameName = (rawName: unknown): string => {
  const s = typeof rawName === "string" ? rawName.replace(/_製/g, "").replace(/\$/g, "") : "";
  return /[a-z]/.test(s) ? s.replace(/_/g, " ").trim() : codename(s);
};
export const gameLabel = (system: string, id: unknown, rawName: unknown, suffix = ""): string => {
  const n = gameName(rawName);
  return n ? `${n} (${system} ${id})${suffix}` : `${system} ${id}${suffix}`;
};
/** A monster or sign name, every word capitalised. */
export const title = (s: string): string =>
  s
    .replace(/[_|]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
const cardLabel = (key: string): string => {
  const name = (MONSTERS as Record<string, { Name?: string }>)[key]?.Name;
  return name ? `${title(name)} (Card ${key})` : `Card ${key}`;
};
const charm = (id: number): unknown => ((NjEQ as Record<string, readonly unknown[]>)[`NjTrP${id}`] ?? [])[2];

/** "Tobo Sardine (Sushi Tier 18) — All your Exalted Stamps give ... (RoG Bonus 17)": the Research lists' name [30] and effect [36] of RoG slot `id`. */
function rogLabel(id: number): string {
  const text = String((ResearchLists as unknown as Table)[36][id] ?? "").replace(/_/g, " ");
  const effect = text.replace(/[{}]/g, "").replace(/^\s*[}x]\s*/, "").replace(/^\s*[+%]+\s*/, "").trim();
  const name = String((ResearchLists as unknown as Table)[30][id] ?? "").replace(/_/g, " ");
  const prefix = name ? `${name} (Sushi Tier ${id + 1})` : `Sushi Tier ${id + 1}`;
  return effect ? `${prefix} — ${effect} (RoG Bonus ${id})` : `${prefix} (RoG Bonus ${id})`;
}
/** "Gold Bangle (Jelly Obstruction 15) — Drop Rate (Jelly Bonus 14)": the Research lists' name [45] and effect [46] of obstruction `idx`. */
function jellyLabel(idx: number): string {
  const name = String((ResearchLists as unknown as Table)[45][idx] ?? "").replace(/_/g, " ") || `Obstruction ${idx + 1}`;
  const effect = String((ResearchLists as unknown as Table)[46][idx] ?? "")
    .replace(/_/g, " ")
    .replace(/[{}|]/g, "")
    .replace(/^\s*x\s*/, "")
    .replace(/^\s*[+%]+\s*/, "")
    .replace(/\s+@.*$/, "")
    .trim();
  const prefix = `${name} (Jelly Obstruction ${idx + 1})`;
  return effect ? `${prefix} — ${effect} (Jelly Bonus ${idx})` : `${prefix} (Jelly Bonus ${idx})`;
}

// ===== The cards =====

/**
 * The cards of a bonus type (10 drop rate, 101 its multi): the equipped ones, each as `TalentCalc(-4)` adds it (level x value per level, times the legend talent 21 factor, doubled by a card chip), then every other card of the type
 * as a 0 reference (the page lists them all; placeholders the game gives no experience are left out), then the legend talent 21 factor when it is not 1.
 */
const cardType = (type: number, name: string) =>
  safe(name, (c) => {
    const key = hString((IDforCardBonus as Readonly<Record<string, string>>)[`${type}`]);
    const equipped = equippedCards(c, key);
    const stars = cardStars(c);
    const worn = new Set(equipped.map((e) => e.card));
    const out: ArkhNode[] = equipped.map((e) =>
      row(cardLabel(e.card), e.val, "+", undefined, [
        raw("Card Qty", asNum(c, "Cards", 0, e.card)),
        raw("Star Lv", e.level, `max ${stars.tiers} stars`),
        raw("Bonus/Star", e.per),
        raw("Rift 5th Star", stars.rift),
        raw("Spelunk 6th Star", stars.spelunk),
        ...(e.doubled ? [row("Chip ×2", 2, "x", 0 == e.slot ? "card1" : "card2")] : []),
      ])
    );
    for (const group of CardStuff as unknown as Table[])
      for (const card of group) {
        const id = hString(card[0]);
        if (hString(card[3]) !== key || worn.has(id)) continue;
        const mob = (MONSTERS as Record<string, { ExpGiven?: unknown }>)[id];
        if (mob && asNumber(mob.ExpGiven) <= 1) continue; // an unreleased placeholder
        out.push(row(cardLabel(id), 0, "+", "not equipped"));
      }
    const legend = Thingies(c, "LegendPTS_bonus", 21, 0);
    if (1 !== 1 + legend / 100) out.push(row(gameLabel("Legend", 21, ((LegendTalents as unknown as Table)[21] ?? [])[0], " ×"), 1 + legend / 100, "x", undefined, [raw("Legend PTS", legend)]));
    return out;
  });

/** A card read on its own in the Drop Rate expression: min(per star x its level, cap), the two numbers the game's expression holds (the rows are refused while they do not give the block's number). */
const cardSingle = (key: string, perStar: number, cap: number) =>
  safe(key, (c, val) => {
    const lv = RunCodeOfTypeXforThingY(c, "CardLv", key);
    const expected = Math.min(perStar * lv, cap);
    if (!near(expected, val)) return outOfStep(key, val, expected);
    return [raw("Card Qty", asNum(c, "Cards", 0, key)), raw("Card Lv", lv), raw("Per Star", perStar), raw("Cap", cap), raw(val >= cap ? "CAPPED" : "Uncapped", val)];
  });

// ===== The companions =====

/** What companion `id` grants when the account has it: CompanionDB[id][11] at stage 2, [2] before. */
const grant = (id: number, stage2: boolean): number => asNumber((CompanionDB[id] as readonly unknown[])[stage2 ? 11 : 2]);

/** A companion added as it is: owned, with its bonus (stage 2 says so), or not owned, with what it would grant. */
const companion = (id: number) =>
  safe(`Companion ${id}`, (c, val) => {
    const owned = DNSM_CompanionBon(c).has(`${id}`);
    if (!owned) return [raw("Not owned", 0), row("Would grant", grant(id, false), "+", "if owned")];
    const stage2 = 1 == DNSM_CompanionLVz(c).get(`${id}`);
    return [raw("Owned", 1), row("Bonus", val, "+", stage2 ? "stage 2 (LV2) value — CompanionDB[id][11]" : undefined)];
  });

/**
 * A companion read as a multiplier in the Drop Rate expression: 1 + min(cap, bonus / divisor x mult), plus `stage2Add` outside the cap once it is at stage 2 (never below 1). The four numbers are the game's expression's (the rows are
 * refused while they do not give the block's number).
 */
const companionMulti = (id: number, cap: number, divisor: number, mult: number, stage2Add: number) =>
  safe(`Companion ${id}`, (c, val) => {
    const owned = DNSM_CompanionBon(c).has(`${id}`);
    const stage2 = owned && 1 == CompLV2(c, id);
    const bonus = owned ? grantOf(c, id) : grant(id, false);
    const result = Math.max(1, Math.min(cap, 1 + (owned ? (divisor > 1 ? bonus / divisor : bonus) * mult : 0)) + (stage2 ? stage2Add : 0));
    if (!near(result, val)) return outOfStep(`Companion ${id}`, val, result);
    if (!owned) return [raw("Not owned — no contribution", 0, `Would grant +${bonus} raw if owned`)];
    return [
      row("Raw bonus", bonus, "+", 1 == DNSM_CompanionLVz(c).get(`${id}`) ? "stage 2 (LV2) value" : undefined),
      ...(Number.isFinite(cap) ? [row("Cap", cap, "x")] : []),
      ...(stage2 && stage2Add ? [row("Stage 2 (LV2) bonus", stage2Add, "+", "added outside the cap")] : []),
      row("Result", val, "x"),
    ];
  });
/** The bonus an owned companion has right now (CompanionBon). */
const grantOf = (c: Ctx, id: number): number => DNSM_CompanionBon(c).get(`${id}`) ?? 0;

// ===== Golden food =====

/** `GoldFoodBonuses("DropRatez")` @5056708: the multiplier the golden foods boosts make, then the worn golden food and the Emporium's, each with its amount, quantity and log. */
const goldFood = safe("Golden Food: DropRatez", (c, val) => {
  if (!(0 < val)) return [];
  const m = goldFoodMulti(c);
  const parts = goldFoodParts(c, "DropRatez");
  const sources = present(
    (
      [
        ["etcBonuses(8) Gold Food", m.etc8],
        ["Talent 99 (Hungry For Gold)", m.talent99],
        ["Stamp Golden Food", m.stamp],
        ["Achievement 37 (Nutty Crafter)", m.ach37],
        ["Bubble Shimmeron", m.bubble],
        ["Sigil 14 (Emoji Veggie)", m.sigil14],
        ["Meal Yumi Peachring", m.meal],
        ["Star Sign 69 + Seraph", m.starSign69],
        ["Bribe 36", m.bribe36],
        ["Pristine 14", m.pristine14],
        ["2× Achievement 380", m.ach380],
        ["3× Achievement 383", m.ach383],
        ["Voting Bonus 26", m.voting26],
        ["Talent 209 × Maps", m.talent209],
        ["Companion 48", m.comp48],
        ["Legend 25", m.legend25],
        ["Card cropfall+anni5", m.cropfall + m.anni5],
        ["Companion 155", m.comp155],
        ["Companion 174 ×10000", m.comp174x],
        ["Vault 86", m.vault86],
        [jellyLabel(10), m.jelly10],
        [jellyLabel(51), m.jelly51],
      ] as const
    ).map(([name, v]) => (Math.abs(v) > 1e-9 ? raw(name, v) : null))
  );
  const secret = 1 + (m.set + 50 * m.comp174) / 100;
  const out: ArkhNode[] = [
    row("GFood Multi", m.multi, "x", "SECRET_SET × (Family + Σ sources ÷ 100)", [
      raw("Family Bonus 66", m.fam),
      raw("Sources ÷ 100", m.rest / 100, "Σ every % Gold Food Effect source ÷ 100 (children shown pre-÷100)", sources),
      ...(Math.abs(secret - 1) > 1e-9 ? [row("SECRET_SET multi", secret, "x")] : []),
    ]),
  ];
  const e = parts.equipped;
  if (e) out.push(raw(`Equipped: ${e.item}`, e.val, undefined, [raw("Base Amount", e.amount), raw("Quantity", e.qty), raw("Log Factor", e.log)]));
  const em = parts.emporium;
  if (em) out.push(raw(`Emporium: ${em.item}`, em.val, undefined, [raw("Base Amount", em.amount), raw("Emporium Lv", em.level ?? 0), raw("Eff Qty", em.qty)]));
  return out;
});

// ===== The stamp, the bubble, the sigil, the prayer, the shiny pets and the star signs =====

/** Golden Sixes Stamp (Stamp A38, id 37): its level, its curve there, the exalted stamp doubler with its terms, and the lab and Pristine multipliers of the first two tabs. */
const STAMP_A38 = 37;
const stampA38 = safe("Golden Sixes Stamp (Stamp A38)", (c) => {
  if (!(0 < stampLevel(c, STAMP_A38))) return [];
  const t = stampTerm(c, STAMP_A38);
  const d = stampDoublerTerms(c);
  const level = (name: string, v: number, kind: "raw" | "+" = "+") => row(name, v, kind);
  const doubler = [
    raw("Base Doubler", 100),
    level(gameLabel("Atom", 12, ((AtomInfo as unknown as Table)[12] ?? [])[0]), d.atom12),
    level(gameLabel("Pristine", 20, charm(20)), d.pristine20),
    row(gameLabel("Compass", 76, ((CompassUpg as unknown as Table)[76] ?? [])[0]), d.compass76, "+", undefined, 0 < d.compass76 ? [raw("Compass Level", asNum(c, "Compass", 0, 76))] : undefined),
    level("Emperor Set", d.emperorSet),
    level("Event 18 (×20)", d.event18),
    row("Palette 23", d.palette23, "+", undefined, 0 < asNum(c, "Spelunk", 9, 23) ? [raw("Palette Level", asNum(c, "Spelunk", 9, 23))] : undefined),
    row(gameLabel("Exotic", 49, ((MarketExoticInfo as unknown as Table)[49] ?? [])[0]), d.exotic49, "+", undefined, 0 < asNum(c, "FarmUpg", 69) ? [raw("Exotic Level", asNum(c, "FarmUpg", 69))] : undefined),
    level("Spelunk Legend Talent Slot (Spelunk 4,3)", d.spelunk43),
    level(gameLabel("Legend", 36, ((LegendTalents as unknown as Table)[36] ?? [])[0]), d.legend36),
    level(rogLabel(17), d.sushi17),
    row(jellyLabel(50), d.jelly50 / 100, "+", "Jelly RoG 50 ÷ 100 (game literal)", [jellyRow(c, 50, jellyLabel(50))]),
  ];
  const out: ArkhNode[] = [raw("Stamp Level", asNum(c, "StampLevel", 0, STAMP_A38), undefined), raw("Formula Result", t.base, `${hString(t.det[1])}(${asNumber(t.det[2])},${asNumber(t.det[3])},${t.level})`)];
  if (t.exalted) out.push(row("Exalted ×", t.doubled, "x", undefined, [raw("StampDoubler", d.total, undefined, doubler)]));
  else {
    const key = `${hString(Number2Letter[0])}${STAMP_A38}`;
    out.push(raw("Exalted", 0, "inactive", [raw(`Not exalted (Compass[4] missing key "${key}")`, 0), raw("StampDoubler (if exalted)", d.total, undefined, doubler)]));
  }
  if (2 == MainframeBonus(c, 7)) out.push(row("Certified Stamp Book ×", 2, "x", "Lab node 7"));
  const pristine = Ninja(c, "PristineBon", 17, 0);
  if (0 < pristine) out.push(row(`${gameName(charm(17))} ×`, 1 + pristine / 100, "x", "Pristine 17"));
  return out;
});

/** `DNSM.AlchBubbles.DropRate`: bubble 1 of the Kazam cauldron (3), its level, its curve there and the Prisma multiplier when it is a Prisma bubble. */
const bubble = safe("Droppin Loads (Bubble 3,1)", (c) => {
  const b = bubbleParts(c, 3, 1);
  if (!(0 < b.level)) return [];
  return [raw("Bubble Level", b.level), raw("Base Value", b.curve), ...(b.prisma === undefined ? [] : [row("Prisma Bonus", b.prisma, "x", "cap 5")])];
});

/** `Labb("SigilBonus", 11)`: the sigil's tier, the base that tier gives, and the Artifact 16 and Meritoc 21 factors. */
const sigil11 = safe("Trove Sigil (Sigil 11)", (c) => {
  const s = sigilParts(c, 11);
  if (s.tier < -0.1) return [];
  return [raw("Sigil Level", s.tier), raw("Base Bonus", s.base), row("Artifact 16 Bonus", 1 + s.artifact, "x", "artifact 16"), row("Meritoc 21", 1 + s.meritoc / 100, "x")];
});

/** `prayersReal(7, 0)`: the prayer's level and, worn, its base and level factor; with the Super Bits and no prayer worn, the bits' share instead. */
const prayer7 = safe("Midas Minded (Prayer 7)", (c) => {
  const p = prayerParts(c, 7, 0);
  const level = asNum(c, "PrayersUnlocked", 7);
  if ("bits" == p.branch) return [raw("Prayer Level", level), raw("Super Bits 9/39/53 (no prayer equipped)", p.bits, undefined), raw("Base Bonus", p.base), row("Level Scaling", p.scale, "x")];
  if (p.equipped && 0 < level) return [raw("Prayer Level", level), raw("Equipped", 1), raw("Base Bonus", p.base), row("Level Scaling", p.scale, "x")];
  return [raw("Prayer Level", level), raw(p.equipped ? "Equipped" : "NOT Equipped", 0)];
});

/** `Breeding("ShinyBonusS", 0)`: each pet with a shiny count whose passive is the drop rate (0): its shiny level, the bonus per level and the count. */
const shiny0 = safe("Drop Rate Shiny Pet (Breeding 0)", (c) =>
  shinyPets(c)
    .filter((p) => "0" === p.key)
    .map((p) => {
      const mob = String(((PetStats as unknown as Table[])[p.group][p.pet] ?? [])[0] ?? "");
      const name = ((MONSTERS as Record<string, { Name?: string }>)[mob]?.Name ?? mob).replace(/_/g, " ") || `W${p.group} P${p.pet}`;
      return row(name, p.val, "+", undefined, [raw("Shiny Lv", p.level), raw("Bonus/Lv", p.per), raw("Shiny EXP", p.exp)]);
    })
);

/** The signs that give `StarSigns.Drop` and how much each does (the game's table @6544444 and @6560535). */
const DROP_SIGNS: readonly (readonly [number, number])[] = [
  [14, 5],
  [76, 12],
];
/** `DNSM.StarSigns.Drop`: the active signs of the table, the Silkrode chip's second pass over the worn signs, and what Seraph Cosmos multiplies the sum by. */
const starSigns = safe("Star Signs", (c, val) => {
  if (!(0 < val) && !(0 > val)) return [];
  const active = activeStarSigns(c);
  const counted = DROP_SIGNS.filter(([sign]) => active.includes(`${sign}`));
  const first = counted.reduce((a, [, v]) => a + v, 0);
  const t = seraphUnlocked(c) ? seraphTerms(c) : undefined;
  const factor = t && 0 < val ? t.chip * t.meritoc * t.cosmos : 1;
  const again = val / factor - first;
  // the row is the signs counted a second time (the Silkrode chip): only 0 or `first` is something the game does; anything else is a sign this table lacks
  if (!near(again, 0) && !near(again, first)) return outOfStep("Star Signs", val, 2 * first * factor);
  const names = StarSigns as unknown as Table;
  return [
    ...counted.map(([sign, v]) => row(`${title(String(names[sign][0]))} (Star Sign ${sign})`, v, "+")),
    ...(Math.abs(again) > 1e-9 ? [row("Star chip: equipped signs count twice", again, "+")] : []),
    ...(factor !== 1 ? [row("Seraph Multiplier", factor, "x")] : []),
  ];
});

export const COLLECTION_EXPLAINERS: Record<string, Explainer> = {
  card10: cardType(10, "Drop Rate Cards (Card Type 10)"),
  card101: cardType(101, "Drop Rate Multi Cards (Card Type 101)"),
  mini5a: cardSingle("mini5a", 1.5, 10),
  anni4: cardSingle("anni4Event1", 2, 20),
  luckEvent: cardSingle("luckEvent1", 3, 25),
  comp3: companion(3),
  comp50: companion(50),
  comp22: companion(22),
  comp158: companion(158),
  comp111: companion(111),
  comp132: companion(132),
  comp132x: companionMulti(132, 1.5, 1, 1, 0.2),
  comp168x: companionMulti(168, Infinity, 1, 0.3, 0),
  comp26: companionMulti(26, 1.3, 1, 1, 0),
  comp160: companionMulti(160, Infinity, 1, 0.5, 0),
  comp50x: companionMulti(50, 1.01, 2500, 1, 0),
  goldFood,
  stampA38,
  bubble,
  starSigns,
  prayer7,
  shiny0,
  sigil11,
};
