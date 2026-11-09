// The rows under EtcBonuses 2, 91, 99 and 102 of the Drop Rate V1 tree, and the Efaunt set: one number the game adds up from the worn items, the obols, the Gallery, the Hatrack and the Cape Vine (TotalStats("calcEtcBonuses"),
// N.js @4156881). Each part is a row here; lib/dropRate/systems moves them to their own buckets. No logic from lib/arkh: only the rows' names, order, formats and notes are V1's, as the page's snapshots and Compare are keyed by them.
//
// The items come from the blocks' own pieces (equipEtcLine, obolEntries, trophyTier...), so a row is what the block added. A part the save cannot answer is a noted leaf, never a page error.
import { asNum, asNumber, attr } from "@/lib/game/attr";
import type { Ctx } from "@/lib/game/ctx";
import { DungKEYCHAINS, IDforETCbonus, ITEMS } from "@/lib/game/data";
import { hString } from "@/lib/game/hstring";
import { listAt } from "@/lib/game/lists";
import { chipBonuses } from "@/lib/game/njs/chipBonuses";
import { Companions } from "@/lib/game/njs/Companions";
import { DNSM_AlchBubbles } from "@/lib/game/njs/DNSM";
import { Gallery, nametagItem, nametagTier, trophyTier } from "@/lib/game/njs/Gallery";
import { Minehead } from "@/lib/game/njs/Minehead";
import { RandomEvent } from "@/lib/game/njs/RandomEvent";
import { RunCodeOfTypeXforThingY } from "@/lib/game/njs/RunCodeOfTypeXforThingY";
import { obolEntries } from "@/lib/game/njs/ScrollCircleINFO";
import { Stuff2 } from "@/lib/game/njs/Stuff2";
import { Summoning } from "@/lib/game/njs/Summoning";
import { SushiStuff } from "@/lib/game/njs/SushiStuff";
import { Thingies } from "@/lib/game/njs/Thingies";
import { equipEtcLine, equipSlotSkipped, itemDef } from "@/lib/game/njs/TotalStats";
import type { ArkhNode } from "../node";
import type { Explainer } from "./index";
import { guarded, NOT_READ, present, raw, row, when } from "./talent";

type Item = Readonly<Record<string, unknown>>;
type Carrier = { key: string; name: string; type: string; stat: string; val: number };

const ALL_ITEMS = Object.entries(ITEMS as Record<string, Item>);
const sum = (rows: ArkhNode[]) => rows.reduce((a, r) => a + r.val, 0);
const itemName = (key: string, item: Item) => hString(item.displayName || key).replace(/[|_]/g, " ");
/** The item's unique-stat lines that are `stat`, by what each gives. */
const uqVals = (item: Item, stat: string): number[] => [1, 2].filter((n) => item[`UQ${n}txt`] === stat).map((n) => asNumber(item[`UQ${n}val`]));

// ===== The items that give a drop stat, worn or not =====

const DR_STATS: ReadonlySet<unknown> = new Set(["2", "102", "99", "91"].map((id) => (IDforETCbonus as Readonly<Record<string, string>>)[id]));
/** A keychain's stat is rolled per copy (DungKEYCHAINS[i] = [item, stat, tiers...]): its definition has none, so it has no base value either. */
const KEYCHAIN_STAT = new Map((DungKEYCHAINS as unknown as string[][]).map((r) => [r[0], r[1]]));

/** Each item's first drop stat among its unique ones (the replicas are the same trophies and nametags again). */
const CARRIERS = new Map<string, Carrier>(
  ALL_ITEMS.flatMap(([key, item]): [string, Carrier][] => {
    const type = hString(item.Type);
    if (!item.Type || type === "REPLICA_TROPHY" || type === "REPLICA_NAMETAG") return [];
    const first = KEYCHAIN_STAT.get(key) ?? item.UQ1txt;
    const at = DR_STATS.has(first) ? 1 : DR_STATS.has(item.UQ2txt) ? 2 : 0;
    if (!at) return [];
    return [[key, { key, name: itemName(key, item), type, stat: hString(1 === at ? first : item.UQ2txt), val: asNumber(item[`UQ${at}val`]) || 0 }]];
  })
);

/** Rows by group name, the groups in name order and each group's rows from the highest value down. */
const grouped = (items: Carrier[], groupOf: (it: Carrier) => string, make: (group: string, items: Carrier[]) => ArkhNode): ArkhNode[] => {
  const groups = new Map<string, Carrier[]>();
  for (const it of items) groups.set(groupOf(it), [...(groups.get(groupOf(it)) ?? []), it]);
  return [...groups.keys()].sort().map((g) => make(g, groups.get(g)!.sort((a, b) => b.val - a.val)));
};

// ===== The worn items =====

const TYPE_LABELS: Readonly<Record<string, string>> = {
  HELMET: "Helmets", SHIRT: "Shirts", ATTIRE: "Attire", PANTS: "Pants", SHOES: "Shoes", CAPE: "Capes", PENDANT: "Pendants", KEYCHAIN: "Keychains",
  SPEAR: "Weapons (Spears)", BOW: "Weapons (Bows)", WAND: "Weapons (Wands)", FISTICUFF: "Weapons (Fists)",
  PICKAXE: "Mining Tools", HATCHET: "Chopping Tools", FISHING_ROD: "Fishing Tools", BUG_CATCHING_NET: "Catching Tools", TRAP_BOX_SET: "Trapping Tools", WORSHIP_SKULL: "Worship Skulls",
};
/** The kinds another part shows, each with its own catalog. */
const NOT_WORN_HERE = new Set(["CIRCLE_OBOL", "SQUARE_OBOL", "HEXAGON_OBOL", "SPARKLE_OBOL", "NAMETAG", "TROPHY", "PREMIUM_HELMET"]);
const DOUBLER: Readonly<Record<number, string>> = { 3: "Pendant Doubler (Lab Chip)", 9: "Keychain Doubler (Lab Chip)", 10: "Trophy Doubler (Lab Chip)" };

/** TotalStats' step 1 @4156881 for this stat: one row per slot. Only the first row of slots (16) has a chip's doubling or Well Dressed (slot 15, Research square 172). */
function equipmentPart(c: Ctx, id: string, stat: string): ArkhNode {
  const worn: ArkhNode[] = [];
  const shown = new Set<string>();
  for (let f = 0; f < 2; f++) {
    for (let O = 0, n = 8 + 8 * (1 - f); O < n; O++) {
      if (equipSlotSkipped(c, f, O)) continue;
      const lines = [0, 1].map((e) => equipEtcLine(c, f, O, e)).filter((l) => l.stat === stat);
      const item = lines.reduce((a, l) => a + l.amount, 0);
      if (!(0 < item)) continue;
      const key = hString(attr(c, "EquipmentOrder", f, O));
      shown.add(key);
      const multi = lines[0].multi;
      const boosters =
        1 === multi
          ? undefined
          : [
              row("Item Bonus (raw)", item, "+", "Stat value built into the item before any boosters"),
              15 === O
                ? row("Well Dressed (Grid 172)", multi, "x", `Grid M4 — multiplies the first MISC bonus on Attire by 1 + ${((multi - 1) * 100).toFixed(2)}/100`)
                : row(DOUBLER[O], multi, "x", "Lab chip in this character's slot doubles this stat"),
            ];
      worn.push(row(CARRIERS.get(key)?.name ?? (key.replace(/_/g, " ") || `Row ${f} Slot ${O}`), lines.reduce((a, l) => a + l.multi * l.amount, 0), "+", `Equipped — R${f} S${O}`, boosters));
    }
  }
  const capeOn = 1 == Gallery(c, "CapevineBonusesSystemON", 0, 0);
  const free = [...CARRIERS.values()].filter((it) => it.stat === stat && !shown.has(it.key) && !NOT_WORN_HERE.has(it.type) && !(capeOn && "CAPE" === it.type));
  const statWords = stat.replace(/^%_/, "").replace(/_/g, " ").toLowerCase();
  const catalog = grouped(free, (it) => TYPE_LABELS[it.type] ?? it.type, (group, items) =>
    row(`${group} — ${items.length} item${1 === items.length ? "" : "s"}`, 0, "+", "All carry +DR built-in; none currently worn", items.map((it) => row(it.name, 0, "+", `Not equipped — would grant +${it.val} ${statWords}`)))
  );
  return row("Equipment Bonuses", sum(worn), "+", `equipment ${id}`, [...worn, ...(catalog.length ? [row("Available DR Items (not equipped)", 0, "+", "Every item in the game with this DR stat type; equip any to add its bonus", catalog)] : [])]);
}

// ===== The obols =====

const OBOL_SHAPES: Readonly<Record<string, string>> = { CIRCLE_OBOL: "Circle", SQUARE_OBOL: "Square", HEXAGON_OBOL: "Hexagon", SPARKLE_OBOL: "Sparkle" };

/** One obol list (0: the character's, 1: the family's): a row per kind of obol, biggest first, its slots under it. */
function obolGroup(c: Ctx, g: number, title: string, stat: string, slotted: Set<string>): ArkhNode | null {
  const kinds = new Map<string, ArkhNode[]>();
  listAt(c, "ObolEquippedOrder", g).forEach((slot, q) => {
    const val = obolEntries(c, g, q, slot).filter((e) => e[0] === stat && 0 < asNumber(e[1])).reduce((a, e) => a + asNumber(e[1]), 0);
    if (!(0 < val)) return;
    const key = hString(slot);
    slotted.add(key);
    kinds.set(key, [...(kinds.get(key) ?? []), row(`Slot ${q}`, val, "+")]);
  });
  if (!kinds.size) return null;
  const rows = [...kinds].map(([key, slots]) => {
    const carrier = CARRIERS.get(key);
    const shape = carrier && OBOL_SHAPES[carrier.type];
    return row(`${carrier?.name ?? key.replace(/_/g, " ")}${shape ? ` (${shape})` : ""}${1 < slots.length ? ` × ${slots.length}` : ""}`, sum(slots), "+", undefined, slots);
  });
  rows.sort((a, b) => b.val - a.val);
  return row(title, sum(rows), "+", undefined, rows);
}

function obolPart(c: Ctx, id: string, stat: string): ArkhNode {
  const slotted = new Set<string>();
  const groups = present([obolGroup(c, 0, "Personal", stat, slotted), obolGroup(c, 1, "Family", stat, slotted)]);
  const free = [...CARRIERS.values()].filter((it) => it.stat === stat && it.type in OBOL_SHAPES && !slotted.has(it.key));
  const catalog = grouped(free, (it) => OBOL_SHAPES[it.type], (shape, items) =>
    row(`${shape} Obols — ${items.length} type${1 === items.length ? "" : "s"}`, 0, "+", undefined, items.map((it) => row(it.name, 0, "+", `Not equipped — would grant +${it.val} per slot`)))
  );
  return row("Obol Bonuses", sum(groups), "+", `obol ${id}`, [...groups, ...(catalog.length ? [row("Available DR Obols (not equipped)", 0, "+", "Every DR-capable obol you don't currently have slotted", catalog)] : [])]);
}

// ===== The Gallery =====

/** `GalleryBonusMulti` @11137789, by its terms. */
function galleryMultiRow(c: Ctx): ArkhNode {
  const level = asNum(c, "Spelunk", 13, 4);
  return row(
    "Gallery Bonus Multi",
    Gallery(c, "GalleryBonusMulti", 0, 0),
    "x",
    undefined,
    present([
      when(3 * level, (v) => raw("Gallery Level", v, "3 per level", [raw("Level", level)])),
      when(10 * chipBonuses(c, "troph"), (v) => raw("Silkrode Motherboard (Chip 16)", v)),
      when(3 * Thingies(c, "ClamWorkBonus", 7, 0), (v) => raw("Glasstic Brain (Clam Work 7)", v)),
      when(RandomEvent(c, "KillroyBonuses", 3, 0), (v) => raw("Skull Shop Tier 3 (Killroy 3)", v)),
      when(Math.min(20, DNSM_AlchBubbles(c, "Y13")), (v) => raw("Codfrey Rulz OK (Bubble Y13, capped 20)", v, "kazam bubble 13")),
      when(Math.min(RunCodeOfTypeXforThingY(c, "CardLv", "w7a11"), 10), (v) => raw("Coralcave Crab (Card w7a11, capped 10)", v)),
      when(Companions(c, 49), (v) => raw("Bubba The Seal (Companion 49)", v, undefined, [raw("Owned", 1), raw("Bonus", v)])),
      when(SushiStuff(c, "RoG_BonusQTY", 54, 0), (v) => raw("Dulce Vitiri (Sushi Tier 55) — Gallery Bonus Multi (RoG Bonus 54)", v)),
    ])
  );
}

type Placed = { key: string; tier: number; where: ArkhNode; note: string };
const NAMETAGS = ALL_ITEMS.filter(([, item]) => "NAMETAG" === item.Type);
const TROPHIES = ALL_ITEMS.filter(([key]) => /^Trophy\d+$/.test(key));

/** The placed nametags or trophies giving `stat`, each tier x GalleryBonusMulti x its base (what GalleryBonTOT adds), then the ones not placed. Named by the item, whatever the slot: the page's Compare is keyed by the name. */
function placedRows(c: Ctx, stat: string, placed: Placed[], every: [string, Item][]): ArkhNode[] {
  let multi: ArkhNode | undefined; // the same row under each one
  const have = new Set(placed.map((p) => p.key));
  const rows = placed.flatMap((p) => {
    const item = itemDef(p.key);
    return uqVals(item, stat).map((base) => {
      multi ??= galleryMultiRow(c);
      return row(itemName(p.key, item), p.tier * multi.val * base, "+", p.note, [p.where, row("Tier", p.tier, "x"), multi, raw("Base", base)]);
    });
  });
  const missing = every.filter(([key]) => !have.has(key)).flatMap(([key, item]) => uqVals(item, stat).map((base) => ({ key, item, base })));
  missing.sort((a, b) => b.base - a.base);
  return [...rows, ...missing.map(({ key, item, base }) => row(itemName(key, item), 0, "+", `Not in gallery — base +${base}, scales with Tier × Gallery Bonus Multi`))];
}

const galleryOn = (c: Ctx) => 1 == Gallery(c, "GalleryBonusSystemON", 0, 0);

function nametagPart(c: Ctx, id: string, stat: string): ArkhNode {
  const placed: Placed[] = [];
  (galleryOn(c) ? listAt(c, "Spelunk", 17) : []).forEach((_, e) => {
    const level = asNum(c, "Spelunk", 17, e);
    if (1 <= level) placed.push({ key: nametagItem(e), tier: nametagTier(level), where: raw("Level", level), note: `gallery level ${level}` });
  });
  const rows = placedRows(c, stat, placed, NAMETAGS);
  return row("Nametag Bonuses", sum(rows), "+", `nametag ${id}`, rows);
}

function trophyPart(c: Ctx, id: string, stat: string): ArkhNode {
  const placed: Placed[] = [];
  (galleryOn(c) ? listAt(c, "Spelunk", 16) : []).forEach((_, e) => {
    const trophy = asNum(c, "Spelunk", 16, e);
    if (1 <= trophy) placed.push({ key: `Trophy${Math.round(trophy)}`, tier: trophyTier(c, e), where: raw("Slot", e), note: `gallery slot ${e}` });
  });
  const rows = placedRows(c, stat, placed, TROPHIES);
  return row("Trophy Bonuses", sum(rows), "+", `trophy ${id}`, rows);
}

// ===== The Hatrack and the Cape Vine =====

/** `HatrackBonusMulti` @11144415, by its terms. */
function hatrackMultiRow(c: Ctx): ArkhNode {
  return row(
    "Hatrack Bonus Multi",
    Gallery(c, "HatrackBonusMulti", 0, 0),
    "x",
    undefined,
    present([
      when(listAt(c, "Spelunk", 46).length, (v) => raw("Hats Owned", v)),
      when(Companions(c, 31), (v) => raw("Wild Boar (Companion 31)", v, "Hat Rack Bonus Multi")),
      when(10 * Summoning(c, "EventShopOwned", 30, 0), (v) => raw("Hatrack Boutique Bonus (Event Shop 30)", v)),
      when(Minehead(c, "BonusQTY", 21, 0), (v) => raw("Hatrack Floor Bonus (Minehead 21)", v)),
      when(SushiStuff(c, "RoG_BonusQTY", 36, 0), (v) => raw("Abalone Sashimi (Sushi Tier 37) — Hat Rack Multi (RoG Bonus 36)", v)),
    ])
  );
}

function hatrackPart(c: Ctx, id: string, stat: string): ArkhNode {
  let multi: ArkhNode | undefined;
  const rows = (1 == Gallery(c, "PremHatBonusesSystemON", 0, 0) ? listAt(c, "Spelunk", 46) : []).flatMap((hat) => {
    const key = hString(hat);
    const item = itemDef(key);
    return uqVals(item, stat).map((base) => {
      multi ??= hatrackMultiRow(c);
      return row(itemName(key, item), multi.val * base, "+", undefined, [multi, raw("Base", base)]);
    });
  });
  return row("Hatrack Bonuses", sum(rows), "+", `premhat ${id}`, rows);
}

/** `CapevineBonusMulti` @11146799 of vine slot n, by its terms. */
function capeMultiRow(c: Ctx, n: number, golden: boolean): ArkhNode {
  return row(
    "Cape Vine Bonus Multi",
    Gallery(c, "CapevineBonusMulti", n, 0),
    "x",
    undefined,
    present([
      raw("Capes in the Vine", listAt(c, "Spelunk", 54).length, "+1% each"),
      when(Companions(c, 105), (v) => raw("Catherine (Companion 105)", v, "Cape Vine Bonus Multi")),
      golden ? null : row("Regular Vine", 0.25, "x", "Only Golden Vine slots give the full bonus"),
    ])
  );
}

function capeVinePart(c: Ctx, id: string, stat: string): ArkhNode {
  const rows = (1 == Gallery(c, "CapevineBonusesSystemON", 0, 0) ? listAt(c, "Spelunk", 54) : []).flatMap((cape, n) => {
    const key = hString(cape);
    const item = itemDef(key);
    const golden = Stuff2(c, "GoldCapeVinesOwned", 0, 0) > n;
    return uqVals(item, stat).map((base) => row(itemName(key, item), Gallery(c, "CapevineBonusMulti", n, 0) * base, "+", `${golden ? "Golden Vine" : "Vine"} slot ${n + 1}`, [capeMultiRow(c, n, golden), raw("Base", base)]));
  });
  return row("Cape Vine Bonuses", sum(rows), "+", `capevine ${id}`, rows);
}

// ===== The sources =====

const PARTS: readonly (readonly [string, (c: Ctx, id: string, stat: string) => ArkhNode])[] = [
  ["Equipment Bonuses", equipmentPart],
  ["Obol Bonuses", obolPart],
  ["Nametag Bonuses", nametagPart],
  ["Trophy Bonuses", trophyPart],
  ["Hatrack Bonuses", hatrackPart],
  ["Cape Vine Bonuses", capeVinePart],
];

/** The parts of `EtcBonuses(id)` that have something to show: a value, a catalog, or a read that failed. */
function etcParts(c: Ctx, id: string): ArkhNode[] {
  const stat = hString((IDforETCbonus as Readonly<Record<string, string>>)[id]);
  const parts = present(PARTS.map(([name, make]) => guarded(name, () => make(c, id, stat)))).filter((p) => p.val || p.children?.length || p.note?.startsWith(NOT_READ));
  return parts.length ? parts : [row("No active sources", 0, "+", "No items on the current character grant this stat")];
}

export const EQUIPMENT_EXPLAINERS: Record<string, Explainer> = {
  etc2: (c) => etcParts(c, "2"),
  etc102: (c) => etcParts(c, "102"),
  etc99: (c) => etcParts(c, "99"),
  etc91: (c) => etcParts(c, "91"),
  efaunt: (_c, val) => [raw("Unlocked", 0 < val ? 1 : 0)],
};
