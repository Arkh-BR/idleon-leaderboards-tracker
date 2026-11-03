import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { collectorPools } from "@/scripts/update-top-damage";
import { computeArkhDamagePools, combineDamagePools, DMG_COLLECTOR_MAP } from "@/lib/arkh/computeDamage";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-11-01-postupdate.json";

describe.skipIf(!existsSync(SAVE))("update-top-damage collectorPools on a real save", () => {
  const load = () => JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));

  it("forces a carried Reliquarium off, so one carrier can't pull every family reference to L2^0.33", () => {
    const save = load();
    save.data.InventoryOrder_0 = ["Quest105"]; // carry the Unstable Reliquarium
    const carried = computeArkhDamagePools(save, 0, DMG_COLLECTOR_MAP).l2relic.items[0];
    expect(carried.val).toBeGreaterThan(0); // the injection works: the raw pool has the exponent
    expect(carried.children!.find((c) => c.name === "Carried")!.val).toBe(1);

    const pools = collectorPools(save, 0);
    const item = pools.l2relic.items[0];
    expect(item.val).toBe(0);
    expect(item.name).toBe(carried.name);
    expect(item.children!.find((c) => c.name === "Carried")!.val).toBe(0);
    // Every other pool is untouched.
    const raw = computeArkhDamagePools(save, 0, DMG_COLLECTOR_MAP);
    for (const k of Object.keys(raw).filter((k) => k !== "l2relic")) expect(pools[k], k).toEqual(raw[k]);
    expect(combineDamagePools(pools).total).toBeGreaterThan(combineDamagePools(raw).total);
  });

  it("is a no-op for a character that doesn't carry it", () => {
    const save = load();
    save.data.InventoryOrder_0 = [];
    expect(collectorPools(save, 0)).toEqual(computeArkhDamagePools(save, 0, DMG_COLLECTOR_MAP));
  });
});
