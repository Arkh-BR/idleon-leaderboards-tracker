import { describe, it, expect } from "vitest";
import { deriveGatedTalentsFor } from "@/scripts/_shared/classGating";
import { AFK_CLASS_TALENTS } from "@/lib/arkh/stats/systems/afk/afk";
import { AFK_NODES, AFK_ROOT } from "@/lib/arkh/stats/defs/afk-gains";
import { topAfkFlatForClass } from "@/lib/afkGains/topAfkGains";
import { TOP_AFK_PLAYERS_SCANNED } from "@/lib/afkGains/topAfkGains.meta";

const g = globalThis as unknown as { window?: unknown };
if (!g.window) g.window = g;

const T88 = `${AFK_ROOT} / ${AFK_NODES.pool} / Idle Brawling (Talent 88)`;

describe("AFK Gains Observed Max", () => {
  it("gates the four class AFK talents and never the star talents (spec A10)", () => {
    expect(deriveGatedTalentsFor(AFK_CLASS_TALENTS).map((t) => t.id).sort((a, b) => a - b)).toEqual([79, 88, 268, 448]);
    expect(deriveGatedTalentsFor([621, 650])).toEqual([]);
  });

  it("the generated reference keeps Idle Brawling for a Royal Guardian and zeroes it for a Wizard", () => {
    expect(TOP_AFK_PLAYERS_SCANNED).toBeGreaterThanOrEqual(20);
    expect(topAfkFlatForClass(null)[AFK_ROOT]).toBeGreaterThan(0);
    expect(topAfkFlatForClass("Royal_Guardian")[T88]).toBeGreaterThan(0); // Warrior tab (Rage Basics)
    expect(topAfkFlatForClass("Wizard")[T88]).toBe(0);
  });
});
