// ===== EXTERNAL CONTEXT MULTIPLIERS =====
// Some talents' final bonus depends on an EXTERNAL counter that isn't
// part of the talent's formula itself — e.g. Tal 328 (Archlord) scales
// against Plunderous Kills (OLA[139]), Tal 655 (Boss Spillover) scales
// against Skulls Beaten (OLA[189]).
//
// Instead of hardcoding `if (id === 328)` branches inside talent.resolve,
// this registry lets talent.resolve discover the pattern declaratively
// and apply a generic post-processing step:
//
//   1. Compute the talent's raw value via the standard flow
//      (per-char OR account-wide cross-char getbonus2).
//   2. If the talent has an entry here, read its external counter,
//      apply the wrap function, and emit a wrapped node with the
//      counter as an extra kid.
//
// Adding a new talent that scales against an external counter:
//
//   - Find its OLA index (search corgan-source/N.js for the in-game lookup).
//   - Add an entry with the wrap formula and a label/note generator.
//   - That's it — talent.resolve picks it up automatically; no code edits
//     in the resolver itself.

import type { CorganNode } from "../../../node";
import { node } from "../../../node";
import { optionsListData } from "../../../save/data";
import { getLOG } from "../../../formulas";

/** Spec for a talent whose final bonus = wrap(rawTalentVal, counter). */
export type ExternalContextSpec = {
  /** Human-readable name of the external counter (shown as a kid label). */
  counterLabel: string;
  /** Where to read the counter value from. Today only OLA is needed; the
   *  enum keeps the door open for other sources (achievements, kills, etc.). */
  counterSource: { kind: "OLA"; index: number };
  /** Free-text note attached to the counter kid (e.g. "OLA[139] — ..."). */
  counterNote: string;
  /** Applies the external counter to the talent's raw value. Returns the
   *  final value the talent is announcing. */
  wrap: (rawTalentVal: number, counter: number) => number;
  /** Format of the wrapped value: "x" (multiplier) or "+" (additive bonus). */
  fmt: "x" | "+";
  /** Builds the headline note for the wrapped node. Receives both inputs
   *  so the note can mention them inline. */
  noteForActive: (rawTalentVal: number, counter: number) => string;
  /** When the wrap is inactive (raw <= 0 or counter <= 0), this defines
   *  the val to emit and the note to attach. For "x" type the val is
   *  typically 1; for "+" type it's typically 0. */
  inactiveVal: number;
  inactiveNote: (rawTalentVal: number, counter: number) => string;
  /** Optional extra kids inserted alongside the base kids when wrapping.
   *  Useful when the rawTalentVal has a semantic name beyond "raw bonus"
   *  (e.g. "Per Skull" for Tal 655). Receives rawTalentVal so the kid
   *  can carry the live value. */
  extraBaseKids?: (rawTalentVal: number) => CorganNode[];
};

function readCounter(spec: ExternalContextSpec): number {
  if (spec.counterSource.kind === "OLA") {
    return (
      Number((optionsListData as any)[spec.counterSource.index]) || 0
    );
  }
  return 0;
}

export const EXTERNAL_CONTEXT_MULTIPLIERS: Record<number, ExternalContextSpec> = {
  // Tal 328 — Archlord Of The Pirates (Siege Breaker).
  // Final bonus = 1 + (talent × log10(Plunderous Kills)) / 100.
  // The raw talent val is the % per log step; multiplying by log(kills)
  // gives the actual % EXP/DR bonus, then "1 + x/100" turns the %
  // into a multiplier.
  328: {
    counterLabel: "Plunderous Kills",
    counterSource: { kind: "OLA", index: 139 },
    counterNote: "OLA[139] — count of plunderous kills",
    wrap: (talVal, plunder) => 1 + (talVal * getLOG(plunder)) / 100,
    fmt: "x",
    noteForActive: (talVal, plunder) =>
      `1 + (${talVal.toFixed(2)} talent × log(${plunder})) / 100`,
    inactiveVal: 1,
    inactiveNote: (talVal, plunder) =>
      plunder <= 0
        ? "Inactive — no Plunderous Kills (OLA[139])"
        : "Inactive — Archlord talent contributes 0",
    // Surface the talent formula result as an explicit kid so the
    // gen-source-catalog handler can pick it up by name. We used to
    // anchor on the sibling "Reference Character: <name>" node for
    // this value, but that node moved inside Base Level (it only
    // affects the raw lv used as Points Invested), breaking the
    // depth=1 lookup.
    extraBaseKids: (talVal) => [
      node("Talent Value", talVal, null, {
        fmt: "raw",
        note: "talent.resolve(328) val — input to the Plunderous Kills wrap",
      }),
    ],
  },

  // Tal 655 — Boss Battle Spillover (star talent).
  // Final bonus = Per-Skull × Skulls Beaten.
  // The raw talent val is the per-skull contribution (decay(25, 100, lv)),
  // and OLA[189] counts how many bosses' skulls have been beaten.
  655: {
    counterLabel: "Skulls Beaten",
    counterSource: { kind: "OLA", index: 189 },
    counterNote: "OLA[189] — count of skulls beaten",
    wrap: (perSkull, skulls) => perSkull * skulls,
    fmt: "+",
    noteForActive: (perSkull, skulls) =>
      `${perSkull.toFixed(2)} per skull × ${skulls} skulls`,
    inactiveVal: 0,
    inactiveNote: (perSkull, skulls) =>
      skulls <= 0
        ? "Inactive — no Skulls Beaten (OLA[189])"
        : "Inactive — Per-Skull contribution is 0",
    // Surface the per-skull value as an explicit kid — the wrapped
    // headline already reflects the total, but seeing the per-unit
    // contribution makes the multiplier easier to reason about.
    extraBaseKids: (perSkull) => [
      node("Per Skull", perSkull, null, { fmt: "raw" }),
    ],
  },
};

/** Convenience: true if the talent has an external-context wrap. */
export function hasExternalContext(talentId: number): boolean {
  return talentId in EXTERNAL_CONTEXT_MULTIPLIERS;
}

/** Apply a talent's external-context wrap to its raw value. Returns the
 *  wrapped node with the standard kids plus a counter kid; emits the
 *  inactive shape (val=inactiveVal, note explains why) when the wrap
 *  can't activate. Caller passes the kids that produced rawTalentVal
 *  so the wrapped node nests them and the user can drill into the raw
 *  computation. */
export function applyExternalContext(
  talentId: number,
  rawTalentVal: number,
  baseKids: CorganNode[],
  talentName: string
): CorganNode | null {
  const spec = EXTERNAL_CONTEXT_MULTIPLIERS[talentId];
  if (!spec) return null;
  const counter = readCounter(spec);
  const extraKids = spec.extraBaseKids
    ? spec.extraBaseKids(rawTalentVal)
    : [];
  const counterKid = node(spec.counterLabel, counter, null, {
    fmt: "raw",
    note: spec.counterNote,
  });
  if (rawTalentVal > 0 && counter > 0) {
    return node(
      talentName,
      spec.wrap(rawTalentVal, counter),
      [...baseKids, ...extraKids, counterKid],
      {
        fmt: spec.fmt,
        note: spec.noteForActive(rawTalentVal, counter),
      }
    );
  }
  return node(
    talentName,
    spec.inactiveVal,
    [...baseKids, ...extraKids, counterKid],
    {
      fmt: spec.fmt,
      note: spec.inactiveNote(rawTalentVal, counter),
    }
  );
}
