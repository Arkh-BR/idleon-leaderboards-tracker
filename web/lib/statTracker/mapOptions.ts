// Map list for the stat pages: every named map plus every character's
// current map, labelled "W<world> · <name>".

import { MAP_NAMES } from "@/lib/dropRate/mapNames";

export type StatMapOption = { index: number; name: string; world: number; label: string };

const SKIP = new Set(["", "PlayerSelect", "Z", "Nothing", "Filler", "Unused", "fillername"]);

export function worldOf(mapIdx: number): number {
  return Math.floor(mapIdx / 50) + 1;
}

export function buildStatMapOptions(save: unknown): StatMapOption[] {
  const idx = new Set<number>();
  MAP_NAMES.forEach((n, i) => {
    if (n && !SKIP.has(n) && !n.startsWith("Tutorial")) idx.add(i);
  });
  const data = (save as { data?: Record<string, unknown> })?.data ?? {};
  for (const k in data) {
    if (!k.startsWith("CurrentMap_")) continue;
    const v = Number(data[k]);
    if (Number.isFinite(v)) idx.add(v);
  }
  return [...idx]
    .sort((a, b) => a - b)
    .map((i) => {
      const name = (MAP_NAMES[i] || `Map ${i}`).replace(/_/g, " ");
      return { index: i, name, world: worldOf(i), label: `W${worldOf(i)} · ${name}` };
    });
}
