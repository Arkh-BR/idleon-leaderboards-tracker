// ===== EQUIPMENT SYSTEM =====
// Sums equipment UQ stat bonuses across all gear slots, applying chip
// doubling (pendant/keychain/trophy) and grid 172 multiplier on attire.
//
// grid172Multi mirrors the Corgan source: `1 + gbWith(gl, so, 172, ctx) / 100`,
// where gbWith returns perLv × lv × shapeMult × allBonusMulti for Grid M4
// "Well Dressed". For Corsair Uniform (slot 15) at Lv 2 this is ~×1.738.

import { node, type CorganNode } from "../../../node";
import { label, entityName } from "../../entity-names";
import { emmData, equipOrderData } from "../../../save/data";
import { ETC_STAT_NAMES, itemUqMatch } from "../../data/common/equipment";
import { charHasChip, gridBonusValue } from "../w4/lab";
import { DR_ITEMS, type DrItem } from "../../data/dr-items.gen";
import type { SaveData } from "../../../state";

// Equipment "Type" buckets used to group catalog rows (Helmet, Shirt, …).
// Keys mirror the IT website-data `Type` field exactly; values are the
// display labels the catalog rows roll up under.
const TYPE_LABELS: Record<string, string> = {
  HELMET: "Helmets",
  PREMIUM_HELMET: "Premium Helmets",
  SHIRT: "Shirts",
  ATTIRE: "Attire",
  PANTS: "Pants",
  SHOES: "Shoes",
  CAPE: "Capes",
  PENDANT: "Pendants",
  TROPHY: "Trophies",
  NAMETAG: "Nametags",
  KEYCHAIN: "Keychains",
  SPEAR: "Weapons (Spears)",
  BOW: "Weapons (Bows)",
  WAND: "Weapons (Wands)",
  FISTICUFF: "Weapons (Fists)",
  PICKAXE: "Mining Tools",
  HATCHET: "Chopping Tools",
  FISHING_ROD: "Fishing Tools",
  BUG_CATCHING_NET: "Catching Tools",
  TRAP_BOX_SET: "Trapping Tools",
  WORSHIP_SKULL: "Worship Skulls",
  CIRCLE_OBOL: "Obols (Circle)",
  SQUARE_OBOL: "Obols (Square)",
  HEXAGON_OBOL: "Obols (Hexagon)",
  SPARKLE_OBOL: "Obols (Sparkle)",
};

type Ctx = { saveData: SaveData; charIdx: number };

type SlotResult = {
  row: number;
  slot: number;
  rawVal: number;
  val: number;
  itemName: string;
  // Multipliers actually applied — used to render a per-slot breakdown
  // child showing the user where the post-raw value came from.
  chipDoubled: boolean; // pendant/keychain/trophy chip ×2
  wellDressedMulti: number; // grid 172 multi for Attire slot 15 (1 when N/A)
};

function scanSlots(
  emm: any,
  equipOrder: any,
  row: number,
  statNames: string[],
  grid172Multi: number,
  skipSlots: Record<number, boolean> | null,
  chipDoubles: Record<number, boolean> | null
): SlotResult[] {
  const data = emm[row] || {};
  const eqRow = (equipOrder && equipOrder[row]) || {};
  const results: SlotResult[] = [];
  const maxSlot = row === 0 ? 15 : 7;
  for (let slot = 0; slot <= maxSlot; slot++) {
    if (skipSlots && skipSlots[slot]) continue;
    const sd = data[slot] || data[String(slot)];
    let val = 0;
    const itemName = (eqRow[slot] || eqRow[String(slot)] || "") as string;
    const builtIn = itemUqMatch(itemName, statNames);
    if (sd) {
      for (let si = 0; si < statNames.length; si++) {
        const statName = statNames[si];
        if (sd.UQ1txt === statName) val += Number(sd.UQ1val) || 0;
        if (sd.UQ2txt === statName) val += Number(sd.UQ2val) || 0;
      }
    }
    if (builtIn) {
      val += builtIn.val;
      const uqTxtKey = "UQ" + builtIn.uq + "txt";
      const uqValKey = "UQ" + builtIn.uq + "val";
      if (sd && !sd[uqTxtKey] && (Number(sd[uqValKey]) || 0) > 0) {
        val += Number(sd[uqValKey]);
      }
    }
    if (val <= 0) continue;
    const rawVal = val;
    const chipDoubled = row === 0 && !!(chipDoubles && chipDoubles[slot]);
    if (chipDoubled) val *= 2;
    const wellDressedMulti =
      row === 0 && slot === 15 && grid172Multi !== 1 ? grid172Multi : 1;
    if (wellDressedMulti !== 1) val *= wellDressedMulti;
    results.push({
      row,
      slot,
      rawVal,
      val,
      itemName,
      chipDoubled,
      wellDressedMulti,
    });
  }
  return results;
}

export const equipment = {
  resolve(id: number | string | (number | string)[], ctx: Ctx): CorganNode {
    const saveData = ctx.saveData;
    const ids = Array.isArray(id) ? id : [id];
    const statNames: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const names = ETC_STAT_NAMES[String(ids[i])];
      if (names) for (let j = 0; j < names.length; j++) statNames.push(names[j]);
    }
    if (!statNames.length)
      return node("Equipment " + id, 0, null, { note: "equipment " + id });
    const emm = (emmData as any)[ctx.charIdx];
    if (!emm)
      return node("Equipment Bonuses", 0, null, { note: "equipment " + id });

    // Grid M4 "Well Dressed" — multiplies the first MISC bonus on Attire (slot 15).
    // Now wired through gridBonusValue() instead of the previous Stage 3 stub.
    const grid172Multi = 1 + gridBonusValue(172, saveData) / 100;

    const sp = saveData.spelunkData || [];
    const galleryOn =
      ((sp[16] as any[])?.length > 0) || ((sp[17] as any[])?.length > 0);
    const premhatOn = (sp[46] as any[])?.length > 0;
    let skipSlots: Record<number, boolean> | null = null;
    if (galleryOn || premhatOn) {
      skipSlots = {};
      if (galleryOn) {
        skipSlots[10] = true;
        skipSlots[14] = true;
      }
      if (premhatOn) skipSlots[8] = true;
    }

    const chipDoubles: Record<number, boolean> = {};
    if (charHasChip(ctx.charIdx, "pend")) chipDoubles[3] = true;
    if (charHasChip(ctx.charIdx, "key1")) chipDoubles[9] = true;
    if (charHasChip(ctx.charIdx, "troph")) chipDoubles[10] = true;

    const equipOrder = (equipOrderData as any)[ctx.charIdx];
    const slots0 = scanSlots(
      emm,
      equipOrder,
      0,
      statNames,
      grid172Multi,
      skipSlots,
      chipDoubles
    );
    const slots1 = scanSlots(emm, equipOrder, 1, statNames, grid172Multi, null, null);
    const allSlots = slots0.concat(slots1);

    let total = 0;
    const equippedKeys = new Set<string>();
    const children: CorganNode[] = [];
    // Build a key → catalog entry lookup so equipped items get the same
    // friendly names the unequipped catalog shows below.
    const catalogByKey = new Map<string, DrItem>();
    for (const it of DR_ITEMS) catalogByKey.set(it.key, it);
    for (let i = 0; i < allSlots.length; i++) {
      const s = allSlots[i];
      total += s.val;
      if (s.itemName) equippedKeys.add(s.itemName);
      const catalogHit = catalogByKey.get(s.itemName);
      const displayName =
        entityName("Item", s.itemName) ||
        catalogHit?.name ||
        s.itemName.replace(/_/g, " ") ||
        "Row " + s.row + " Slot " + s.slot;
      // Build per-slot breakdown if Well Dressed (grid 172) or a chip
      // doubler actually changed the value. Surface the raw item bonus
      // first, then each multiplier so the user sees exactly where the
      // final number came from. No transformations → no children (keeps
      // the tree compact for the 90% of rows that don't have either).
      let slotChildren: CorganNode[] | null = null;
      if (s.chipDoubled || s.wellDressedMulti !== 1) {
        slotChildren = [
          node("Item Bonus (raw)", s.rawVal, null, {
            fmt: "+",
            note: "Stat value built into the item before any boosters",
          }),
        ];
        if (s.chipDoubled) {
          // Pendant (slot 3), Keychain (slot 9), Trophy (slot 10) each
          // get ×2 from their dedicated chip. Naming the chip explicitly
          // so the user knows which chip is doing the doubling.
          const chipLabel =
            s.slot === 3
              ? "Pendant Doubler (Lab Chip)"
              : s.slot === 9
              ? "Keychain Doubler (Lab Chip)"
              : "Trophy Doubler (Lab Chip)";
          slotChildren.push(
            node(chipLabel, 2, null, {
              fmt: "x",
              note: "Lab chip in this character's slot doubles this stat",
            })
          );
        }
        if (s.wellDressedMulti !== 1) {
          // grid172Multi = 1 + gridBonusValue(172, …) / 100. The bonus
          // value itself is computed in lab.ts gridBonusValue() — we
          // re-derive it here for the display note so the user knows
          // which grid is responsible.
          const grid172Pct = (s.wellDressedMulti - 1) * 100;
          slotChildren.push(
            node("Well Dressed (Grid 172)", s.wellDressedMulti, null, {
              fmt: "x",
              note:
                "Grid M4 — multiplies the first MISC bonus on Attire by " +
                "1 + " +
                grid172Pct.toFixed(2) +
                "/100",
            })
          );
        }
      }
      children.push(
        node(displayName, s.val, slotChildren, {
          fmt: "+",
          note: "Equipped — R" + s.row + " S" + s.slot,
        })
      );
    }

    // Catalog: list every item in DR_ITEMS matching one of the requested
    // stats AND not already equipped on this char, as zero-val rows. The
    // user explicitly wants to see "what could give DR if I wore it" — so
    // unequipped hats / attire / accessories appear here at 0 with a note.
    // Items already equipped show under the section above with their real
    // contribution; we de-dup by `equippedKeys` to avoid double-listing.
    const statSet = new Set(statNames);
    const catalogByType = new Map<string, DrItem[]>();
    // Equipment-types that belong to OTHER resolvers (obol, nametag, trophy,
    // premhat). Each has its own dedicated catalog rendered as a sibling
    // under etcBonus, so including them here would double-list.
    const SKIP_TYPES_IN_EQUIPMENT_CATALOG = new Set([
      "CIRCLE_OBOL",
      "SQUARE_OBOL",
      "HEXAGON_OBOL",
      "SPARKLE_OBOL",
      "NAMETAG",
      "TROPHY",
      "PREMIUM_HELMET", // covered by the premhat (Hatrack) resolver
    ]);
    for (const it of DR_ITEMS) {
      if (!statSet.has(it.stat)) continue;
      if (equippedKeys.has(it.key)) continue;
      if (SKIP_TYPES_IN_EQUIPMENT_CATALOG.has(it.type)) continue;
      const bucket = TYPE_LABELS[it.type] || it.type;
      if (!catalogByType.has(bucket)) catalogByType.set(bucket, []);
      catalogByType.get(bucket)!.push(it);
    }
    if (catalogByType.size > 0) {
      // Each bucket renders as its own subgroup so 16 premium helmets don't
      // drown out the actually-equipped row above.
      const catalogChildren: CorganNode[] = [];
      // Stable bucket order: alphabetical so the user can scan deterministic.
      const bucketKeys = Array.from(catalogByType.keys()).sort();
      for (const bucket of bucketKeys) {
        const items = catalogByType.get(bucket)!.sort(
          (a, b) => b.val - a.val
        );
        const bucketChildren = items.map((it) =>
          node(it.name, 0, null, {
            fmt: "+",
            note: `Not equipped — would grant +${it.val} ${it.stat
              .replace(/^%_/, "")
              .replace(/_/g, " ")
              .toLowerCase()}`,
          })
        );
        catalogChildren.push(
          node(
            `${bucket} — ${items.length} item${items.length === 1 ? "" : "s"}`,
            0,
            bucketChildren,
            { fmt: "+", note: "All carry +DR built-in; none currently worn" }
          )
        );
      }
      children.push(
        node(
          "Available DR Items (not equipped)",
          0,
          catalogChildren,
          {
            fmt: "+",
            note:
              "Every item in the game with this DR stat type; equip any to add its bonus",
          }
        )
      );
    }

    return node("Equipment Bonuses", total, children, {
      fmt: "+",
      note: "equipment " + id,
    });
  },
};

void label;
