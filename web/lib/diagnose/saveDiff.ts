// What changed between two captured saves: the save keys (a deep diff of
// envelope.data, e.g. before/after removing a weapon) and the tracker-tree
// leaves that moved as a result.

import type { FlatTree } from "@/lib/dropRate/treeFlatten";

/** A save key as the game reads it: JSON strings are parsed, a plain string stays as it is. */
function parseSaveKey(save: Record<string, unknown>, key: string): unknown {
  const raw = save[key];
  if (raw == null) return null;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export type SaveChange = { path: string; before: unknown; after: unknown };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const natural = new Intl.Collator("en", { numeric: true }).compare; // "Lv0_3" < "Lv0_10", whatever the machine's locale

function walk(a: unknown, b: unknown, path: string, out: SaveChange[]) {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) walk(a[i], b[i], `${path}[${i}]`, out);
  } else if (isObj(a) && isObj(b)) {
    // Saves keep many arrays as objects keyed "0", "1"…: those read like array indices.
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(natural))
      walk(a[k], b[k], /^\d+$/.test(k) ? `${path}[${k}]` : `${path}.${k}`, out);
  } else if (a !== b) out.push({ path, before: a, after: b }); // a leaf, an added/removed value, or a type change
}

/** Keys the loader sees: `envelope.data`, each JSON-string value parsed. */
function parsed(env: unknown): Map<string, unknown> {
  const data = ((env as { data?: object })?.data ?? env) as Record<string, unknown>;
  return new Map(Object.keys(data).map((k) => [k, parseSaveKey(data, k)]));
}

/** Deep diff of two save envelopes over `data`, in path order. Paths read like
 *  `EquipOrder_8[0][1]` (array index, or an object key that is a number) or
 *  `Key.field` (any other object key); an added or removed value is one change
 *  with `undefined` on the missing side. */
export function diffSaves(a: unknown, b: unknown): SaveChange[] {
  const [pa, pb] = [parsed(a), parsed(b)];
  const out: SaveChange[] = [];
  for (const k of [...new Set([...pa.keys(), ...pb.keys()])].sort(natural)) walk(pa.get(k), pb.get(k), k, out);
  return out;
}

export type LeafChange = { path: string; before: number | undefined; after: number | undefined };

/** The leaves of two flattened trees (flattenTree) whose value moved by more
 *  than `minRel` of the larger magnitude, in path order. A leaf is a path no
 *  other path extends; a leaf present on one side only is always a change. */
export function diffTrees(flatA: FlatTree, flatB: FlatTree, minRel = 1e-9): LeafChange[] {
  const paths = [...new Set([...Object.keys(flatA), ...Object.keys(flatB)])];
  // ponytail: a node name containing " / " would confuse this — none do today.
  const parents = new Set<string>();
  for (const p of paths) for (let i = p.indexOf(" / "); i >= 0; i = p.indexOf(" / ", i + 1)) parents.add(p.slice(0, i));
  return paths
    .filter((p) => !parents.has(p))
    .sort()
    .map((path) => ({ path, before: flatA[path] as number | undefined, after: flatB[path] as number | undefined }))
    .filter(({ before: x, after: y }) =>
      x === undefined || y === undefined ? x !== y : Math.abs(x - y) > minRel * Math.max(Math.abs(x), Math.abs(y)));
}
