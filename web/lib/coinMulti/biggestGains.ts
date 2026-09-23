// Biggest Gains for the Coin Multi page. The coin multi is a product of 23
// group factors, so matching the Observed Max on one source multiplies the
// total by that group's new factor over its current one:
//   pct : (1 + (S − you + max)/100) / (1 + S/100)
//   raw : (1 + (S − you + max)) / (1 + S)
//   min4: (1 + min(4, max)) / (1 + min(4, you))
// S is the group's current sum, recovered from its factor in the flat tree.

import type { FlatTree } from "@/lib/dropRate/treeFlatten";
import { COIN_GROUPS, COIN_ROOT, type CoinGroupKind } from "@/lib/arkh/stats/defs/coin-multi";

export const MINOR_GAIN_THRESHOLD_PCT = 0.05;

export type CoinGainRow = {
  path: string;
  group: string;
  source: string;
  kind: CoinGroupKind;
  you: number;
  max: number;
  /** % the total Coin Multi rises if this source matched the Observed Max. */
  gainPct: number;
};

function directChildren(a: FlatTree, b: Record<string, number>, parent: string): string[] {
  const prefix = `${parent} / `;
  const out = new Set<string>();
  for (const flat of [a, b]) {
    for (const p of Object.keys(flat)) {
      if (p.startsWith(prefix) && !p.slice(prefix.length).includes(" / ")) out.add(p);
    }
  }
  return [...out];
}

export function computeCoinGains(
  yoursFlat: FlatTree,
  refFlat: Record<string, number>
): { rows: CoinGainRow[]; comparableSources: number } {
  const rows: CoinGainRow[] = [];
  let comparableSources = 0;
  for (const g of COIN_GROUPS) {
    const groupPath = `${COIN_ROOT} / ${g.name}`;
    const factor = Number(yoursFlat[groupPath]);
    if (!Number.isFinite(factor)) continue;
    const S = g.kind === "pct" ? (factor - 1) * 100 : factor - 1;
    for (const path of directChildren(yoursFlat, refFlat, groupPath)) {
      const max = refFlat[path];
      if (typeof max !== "number" || !Number.isFinite(max)) continue;
      const you = Number(yoursFlat[path]) || 0;
      const ratio =
        g.kind === "min4"
          ? (1 + Math.min(4, max)) / (1 + Math.min(4, you))
          : g.kind === "pct"
            ? (1 + (S - you + max) / 100) / (1 + S / 100)
            : (1 + (S - you + max)) / (1 + S);
      const gainPct = (ratio - 1) * 100;
      if (!Number.isFinite(gainPct)) continue;
      comparableSources++;
      if (gainPct > 0) {
        rows.push({ path, group: g.name, source: path.slice(path.lastIndexOf(" / ") + 3), kind: g.kind, you, max, gainPct });
      }
    }
  }
  rows.sort((a, b) => b.gainPct - a.gainPct);
  return { rows, comparableSources };
}

export function splitCoinGains(
  rows: CoinGainRow[],
  threshold: number = MINOR_GAIN_THRESHOLD_PCT
): { major: CoinGainRow[]; minor: CoinGainRow[] } {
  const major: CoinGainRow[] = [];
  const minor: CoinGainRow[] = [];
  for (const r of rows) (r.gainPct >= threshold ? major : minor).push(r);
  return { major, minor };
}
