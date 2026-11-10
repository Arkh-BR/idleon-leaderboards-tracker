import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { DMG_COLLECTOR, DMG_PARENTS } from "@/scripts/update-top-damage";
import { poolsOf } from "@/scripts/_shared/gamePools";
import { computeGameDamage } from "@/lib/game/trackers/damage";
import { DMG_COLLECTOR_MAP } from "@/lib/damage/layers";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const SAVE = "scripts/updater/golden/.cache/arkhe-live-2026-11-01-postupdate.json";

describe.skipIf(!existsSync(SAVE))("update-top-damage computePools on a real save", () => {
  const load = () => JSON.parse(readFileSync(SAVE, "utf8").replace(/^﻿/, ""));
  const rawPools = (save: unknown) => poolsOf(computeGameDamage(save, 0, DMG_COLLECTOR_MAP).tree, DMG_PARENTS);

  it("forces a carried Reliquarium off, so one carrier can't pull every family reference to L2^0.33", () => {
    const save = load();
    save.data.InventoryOrder_0 = ["Quest105"]; // carry the Unstable Reliquarium
    const raw = rawPools(save);
    const carried = raw.l2relic.items[0];
    expect(carried.val).toBeGreaterThan(0); // the injection works: the raw pool has the exponent

    const pools = DMG_COLLECTOR.computePools(save, 0);
    const item = pools.l2relic.items[0];
    expect(item.val).toBe(0);
    expect(item.name).toBe(carried.name);
    expect(item.children).toBeUndefined();
    // Every other pool is untouched.
    for (const k of Object.keys(raw).filter((k) => k !== "l2relic")) expect(pools[k], k).toEqual(raw[k]);
    expect(DMG_COLLECTOR.combine(pools).total).toBeGreaterThan(DMG_COLLECTOR.combine(raw).total);
  });

  it("is a no-op for a character that doesn't carry it, but for the dropped subtree", () => {
    const save = load();
    save.data.InventoryOrder_0 = [];
    const raw = rawPools(save);
    expect(raw.l2relic.items[0].val).toBe(0);
    const pools = DMG_COLLECTOR.computePools(save, 0);
    expect({ ...pools, l2relic: undefined }).toEqual({ ...raw, l2relic: undefined });
    expect(DMG_COLLECTOR.combine(pools).total).toBe(DMG_COLLECTOR.combine(raw).total);
  });
});
