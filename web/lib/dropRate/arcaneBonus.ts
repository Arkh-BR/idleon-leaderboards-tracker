// Arcane Map Bonus — Drop Rate multiplier earned per W7 map based on
// AFK kill count tracked in save.data.MapBon[i][0]. 1:1 port of
// Corgan's _arcaneMulti() in drop-rate-calc.html.

import { MAP_NAMES } from "./mapNames";

function _log10(x: number): number {
  return Math.log(Math.max(x, 1)) / 2.30259;
}

export function arcaneMulti(kills: number): number {
  if (!Number.isFinite(kills) || kills < 1) return 0;
  const lg = _log10(kills);
  const lg2 = Math.log(Math.max(kills, 1)) / Math.log(2);
  return (
    (2 * Math.max(0, lg - 3.5) + Math.max(0, lg2 - 12)) * (lg / 2.5) +
    Math.min(2, kills / 1000) +
    Math.max(5 * (lg - 5), 0)
  );
}

// Multiplier in `dr *= X` form (1 + multi/100). 1.0 means no map bonus.
export function arcaneFactor(kills: number): number {
  return 1 + arcaneMulti(kills) / 100;
}

export type MapOption = {
  index: number;
  name: string;
  kills: number;
  factor: number;
  label: string;
};

// Build a sorted list of maps that have ≥1 kill, formatted for a <select>.
// Always prepends "Town (no AC)" at index 0 so the user can clear the bonus.
export function buildMapOptions(save: unknown): MapOption[] {
  const data = (save as { data?: Record<string, unknown> })?.data ?? {};
  const mapBonRaw: unknown = data.MapBon;
  let mb: number[][] = [];
  if (Array.isArray(mapBonRaw)) {
    mb = (mapBonRaw as any[]).map((e) =>
      Array.isArray(e) ? (e as any[]).map(Number) : [0]
    );
  } else if (typeof mapBonRaw === "string") {
    // Raw save stores MapBon as a flat CSV string "kills,?,?,kills,?,?,...".
    // Each map gets 3 consecutive values.
    const tryJson = (() => {
      try {
        const j = JSON.parse(mapBonRaw);
        return Array.isArray(j) ? j : null;
      } catch {
        return null;
      }
    })();
    if (tryJson) {
      mb = (tryJson as any[]).map((e) =>
        Array.isArray(e) ? (e as any[]).map(Number) : [0]
      );
    } else {
      const flat = mapBonRaw.split(",").map((s) => Number(s) || 0);
      for (let i = 0; i + 2 < flat.length; i += 3) {
        mb.push([flat[i], flat[i + 1], flat[i + 2]]);
      }
    }
  }

  const opts: MapOption[] = [
    { index: 0, name: "Town (no AC)", kills: 0, factor: 1, label: "Town (no AC)" },
  ];
  const added = new Set<number>([0]);
  for (let i = 0; i < mb.length; i++) {
    if (added.has(i)) continue;
    const entry = mb[i];
    if (!Array.isArray(entry)) continue;
    const kills = Number(entry[0]) || 0;
    if (kills < 1) continue;
    const factor = arcaneFactor(kills);
    if (factor <= 1) continue;
    const name = (MAP_NAMES[i] || `Map ${i}`).replace(/_/g, " ");
    const label = `${name} (kills ${formatKills(kills)} → ${factor.toFixed(2)}x)`;
    opts.push({ index: i, name, kills, factor, label });
    added.add(i);
  }

  // Also include every character's CurrentMap_N so we can auto-jump to it
  // when the user selects that char, even if the map has no AFK kills (in
  // which case the arcane factor is 1×). Without this the dropdown would
  // silently fall back to Town for chars sitting on a no-kill map.
  for (const k in data) {
    if (!k.startsWith("CurrentMap_")) continue;
    const idx = Number(data[k]);
    if (!Number.isFinite(idx) || added.has(idx)) continue;
    const killsRaw = Array.isArray(mb[idx]) ? Number(mb[idx][0]) || 0 : 0;
    const factor = killsRaw >= 1 ? arcaneFactor(killsRaw) : 1;
    const name = (MAP_NAMES[idx] || `Map ${idx}`).replace(/_/g, " ");
    const label =
      factor > 1
        ? `${name} (kills ${formatKills(killsRaw)} → ${factor.toFixed(2)}x)`
        : `${name} (no AC)`;
    opts.push({ index: idx, name, kills: killsRaw, factor, label });
    added.add(idx);
  }

  // Sort: Town first, then by index for stable ordering.
  opts.sort((a, b) => {
    if (a.index === 0) return -1;
    if (b.index === 0) return 1;
    return a.index - b.index;
  });

  return opts;
}

function formatKills(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}
