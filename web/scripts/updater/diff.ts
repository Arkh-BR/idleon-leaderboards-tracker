// ===== Idleon updater — snapshot diff =====
// Generic added/removed/changed diff over the keyed maps and the string set.

export type MapDiff = {
  added: string[];
  removed: string[];
  changed: { key: string; before: unknown; after: unknown }[];
};

/** Stable stringify (sorted keys) so {a:1,b:2} === {b:2,a:1} when comparing. */
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as object).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

export function diffMaps(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): MapDiff {
  const bKeys = new Set(Object.keys(before));
  const aKeys = new Set(Object.keys(after));
  const added = [...aKeys].filter((k) => !bKeys.has(k)).sort();
  const removed = [...bKeys].filter((k) => !aKeys.has(k)).sort();
  const changed: MapDiff["changed"] = [];
  for (const k of [...aKeys].filter((x) => bKeys.has(x)).sort()) {
    if (stable(before[k]) !== stable(after[k])) {
      changed.push({ key: k, before: before[k], after: after[k] });
    }
  }
  return { added, removed, changed };
}

export type SetDiff = { added: string[]; removed: string[] };

export function diffSets(before: string[], after: string[]): SetDiff {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: [...a].filter((x) => !b.has(x)).sort(),
    removed: [...b].filter((x) => !a.has(x)).sort(),
  };
}

export function isMapDiffEmpty(d: MapDiff): boolean {
  return d.added.length === 0 && d.removed.length === 0 && d.changed.length === 0;
}
