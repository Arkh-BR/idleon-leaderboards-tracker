// ===== OBOL SYSTEM =====
// Sums obol UQ stat bonuses from personal + family obols. Each obol entry
// holds the base item name; the per-slot map (ObolEqMAP) carries rolled
// stone upgrades that add to the matching UQ slot of the item.
//
// Display strategy: instead of dumping 30+ raw rows ("ObolSilverPop slot 1,
// ObolSilverPop slot 3, …"), we group equipped obols by type so the user
// sees "Silver Obol of Pop Pop × 12 → +36" with the per-slot breakdown
// nested underneath. Friendly names come from the DR_ITEMS catalog when the
// obol carries a DR-family built-in stat, with a fallback that humanises
// the raw item key. Unequipped DR-capable obols show in a catalog section
// at the bottom (zero-val rows) so the user sees what they could equip.

import { node, type CorganNode } from "../../../node";
import { entityName } from "../../entity-names";
import {
  obolNamesData,
  obolMapsData,
  obolFamilyNames,
  obolFamilyMaps,
} from "../../../save/data";
import { ETC_STAT_NAMES, itemUqMatch } from "../../data/common/equipment";
import { DR_ITEMS } from "../../data/dr-items.gen";
import type { SaveData } from "../../../state";

type Ctx = { saveData: SaveData; charIdx: number };

type ObolResult = { idx: number; name: string; val: number };

function scanObols(
  names: any[] | undefined,
  maps: any | undefined,
  statNames: string[]
): ObolResult[] {
  const results: ObolResult[] = [];
  const len = names ? names.length : 0;
  for (let i = 0; i < len; i++) {
    const name = (names as any[])[i];
    if (!name || name === "Blank" || name === "Null") continue;
    const mapData = maps ? maps[i] || maps[String(i)] : null;
    let val = 0;
    const builtIn = itemUqMatch(name, statNames);
    if (builtIn) {
      val += builtIn.val;
      if (mapData) {
        const uqValKey = "UQ" + builtIn.uq + "val";
        val += Number(mapData[uqValKey]) || 0;
      }
    }
    if (val > 0) results.push({ idx: i, name, val });
  }
  return results;
}

// Catalog lookup: obol key → friendly name. Used to label both equipped
// rows and the unequipped catalog with the IT website-data display name
// (e.g. "ObolSilverPop" → "Silver Obol of Pop Pop").
const OBOL_CATALOG_BY_KEY = new Map<
  string,
  { name: string; type: string; val: number; stat: string }
>();
for (const it of DR_ITEMS) {
  if (it.type.endsWith("_OBOL")) {
    OBOL_CATALOG_BY_KEY.set(it.key, {
      name: it.name,
      type: it.type,
      val: it.val,
      stat: it.stat,
    });
  }
}

// Map the OBOL Type to a short shape label users recognise from in-game UI.
const OBOL_SHAPE_LABEL: Record<string, string> = {
  CIRCLE_OBOL: "Circle",
  SQUARE_OBOL: "Square",
  HEXAGON_OBOL: "Hexagon",
  SPARKLE_OBOL: "Sparkle",
};

function obolDisplayName(rawKey: string): string {
  const cat = OBOL_CATALOG_BY_KEY.get(rawKey);
  if (cat) return cat.name;
  const ent = entityName("Item", rawKey);
  if (ent) return ent;
  return rawKey.replace(/_/g, " ");
}

/** Group an array of scanned obols by their item key and render one row
 *  per type with a sub-tree of per-slot contributions. Sort by total desc. */
function renderObolGroup(
  results: ObolResult[],
  groupName: string
): { node: CorganNode; total: number } {
  const byKey = new Map<string, ObolResult[]>();
  for (const r of results) {
    if (!byKey.has(r.name)) byKey.set(r.name, []);
    byKey.get(r.name)!.push(r);
  }
  const typeRows: { name: string; total: number; node: CorganNode }[] = [];
  for (const [key, slots] of byKey) {
    const typeTotal = slots.reduce((a, b) => a + b.val, 0);
    const shape =
      OBOL_SHAPE_LABEL[OBOL_CATALOG_BY_KEY.get(key)?.type ?? ""] ?? "";
    // Drop the "× 1" qualifier when there's only one slot; otherwise show
    // count so the user instantly sees "Silver Obol of Pop Pop × 12".
    const countSuffix = slots.length > 1 ? ` × ${slots.length}` : "";
    const shapeSuffix = shape ? ` (${shape})` : "";
    const slotChildren = slots
      .slice()
      .sort((a, b) => a.idx - b.idx)
      .map((s) =>
        node(`Slot ${s.idx}`, s.val, null, { fmt: "+" })
      );
    typeRows.push({
      name: obolDisplayName(key),
      total: typeTotal,
      node: node(
        obolDisplayName(key) + shapeSuffix + countSuffix,
        typeTotal,
        slotChildren,
        { fmt: "+" }
      ),
    });
  }
  typeRows.sort((a, b) => b.total - a.total);
  const total = typeRows.reduce((a, r) => a + r.total, 0);
  return {
    node: node(
      groupName,
      total,
      typeRows.map((r) => r.node),
      { fmt: "+" }
    ),
    total,
  };
}

/** Build the "Available DR Obols (not equipped)" catalog: every obol in the
 *  global DR_ITEMS catalog matching the requested stat that isn't currently
 *  equipped in Personal OR Family. Grouped by shape so the list mirrors the
 *  in-game UI's tabs. */
function renderUnequippedCatalog(
  statNames: string[],
  equippedKeys: Set<string>
): CorganNode | null {
  const statSet = new Set(statNames);
  const byShape = new Map<
    string,
    { name: string; val: number; key: string; stat: string }[]
  >();
  for (const it of DR_ITEMS) {
    if (!it.type.endsWith("_OBOL")) continue;
    if (!statSet.has(it.stat)) continue;
    if (equippedKeys.has(it.key)) continue;
    const shape = OBOL_SHAPE_LABEL[it.type] || it.type;
    if (!byShape.has(shape)) byShape.set(shape, []);
    byShape.get(shape)!.push({ name: it.name, val: it.val, key: it.key, stat: it.stat });
  }
  if (byShape.size === 0) return null;
  const shapeKeys = Array.from(byShape.keys()).sort();
  const shapeChildren = shapeKeys.map((shape) => {
    const items = byShape.get(shape)!.sort((a, b) => b.val - a.val);
    const itemChildren = items.map((it) =>
      node(it.name, 0, null, {
        fmt: "+",
        note: `Not equipped — would grant +${it.val} per slot`,
      })
    );
    return node(
      `${shape} Obols — ${items.length} type${items.length === 1 ? "" : "s"}`,
      0,
      itemChildren,
      { fmt: "+" }
    );
  });
  return node("Available DR Obols (not equipped)", 0, shapeChildren, {
    fmt: "+",
    note: "Every DR-capable obol you don't currently have slotted",
  });
}

export const obol = {
  resolve(id: number | (number | string)[], ctx: Ctx): CorganNode {
    const ids = Array.isArray(id) ? id : [id];
    const statNames: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const names = ETC_STAT_NAMES[String(ids[i])];
      if (names) for (let j = 0; j < names.length; j++) statNames.push(names[j]);
    }
    if (!statNames.length)
      return node("Obols " + id, 0, null, { note: "obol " + id });

    const charNames = (obolNamesData as any)[ctx.charIdx] || [];
    const charMaps = (obolMapsData as any)[ctx.charIdx] || {};
    const personal = scanObols(charNames, charMaps, statNames);
    const family = scanObols(obolFamilyNames, obolFamilyMaps, statNames);

    const equippedKeys = new Set<string>();
    for (const r of personal) equippedKeys.add(r.name);
    for (const r of family) equippedKeys.add(r.name);

    let total = 0;
    const children: CorganNode[] = [];

    if (personal.length > 0) {
      const grouped = renderObolGroup(personal, "Personal");
      children.push(grouped.node);
      total += grouped.total;
    }
    if (family.length > 0) {
      const grouped = renderObolGroup(family, "Family");
      children.push(grouped.node);
      total += grouped.total;
    }

    const catalogNode = renderUnequippedCatalog(statNames, equippedKeys);
    if (catalogNode) children.push(catalogNode);

    return node("Obol Bonuses", total, children, {
      fmt: "+",
      note: "obol " + id,
    });
  },
};
