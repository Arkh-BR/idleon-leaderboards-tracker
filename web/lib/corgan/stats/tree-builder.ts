// ===== TREE BUILDER =====
// 1:1 port of corgan-source/js/stats/tree-builder.js. Resolves every
// source in each pool, sums them up, and hands the pools to descriptor's
// combine() to produce the final tree.

import type { CorganNode } from "../node";
import type { SystemCtx, SystemResolver } from "./registry";

export type SourceSpec = {
  system: string;
  id?: unknown;
  args?: unknown[];
};

export type Pool = {
  items: CorganNode[];
  sum: number;
  product: number;
};

export type Descriptor = {
  id: string;
  name: string;
  scope?: string;
  category?: string;
  pools: Record<string, SourceSpec[]>;
  combine(
    pools: Record<string, Pool>,
    ctx: SystemCtx
  ): { val: number; children: CorganNode[] };
};

export function buildTree(
  desc: Descriptor,
  catalog: Record<string, SystemResolver>,
  ctx: SystemCtx
): CorganNode {
  const pools: Record<string, Pool> = {};

  for (const poolName in desc.pools) {
    const sources = desc.pools[poolName];
    const items: CorganNode[] = [];
    let sum = 0;
    let product = 1;

    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const system = catalog[src.system];

      if (!system) {
        items.push({
          name: "[" + src.system + "] not implemented",
          val: 0,
        });
        continue;
      }

      const result = system.resolve(src.id, ctx, src.args);
      items.push(result);
      const v = Number(result.val) || 0;
      sum += v;
      product *= v !== 0 ? v : 1;
    }

    pools[poolName] = { items, sum, product };
  }

  const result = desc.combine(pools, ctx);
  return {
    name: desc.name,
    val: result.val,
    // Drop Rate (and any other descriptor headline that ends as a
    // multiplier) renders with the "x" formatter so the value reads
    // "43093.438x" instead of getting auto-truncated to "43.09K" by
    // formatVal's default thousands collapse.
    fmt: "x",
    children: result.children,
  };
}
