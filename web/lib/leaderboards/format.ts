import { formatIdleon } from "@/lib/format";
import type { Notation } from "./types";

const fmtSec = (t: number) => `${t.toFixed(t < 5 ? 3 : 1)}s`;

export function formatMetric(v: number, n: Notation): string {
  if (n === "multiplier") return `${v.toFixed(v < 10 ? 4 : 2)}x`;
  if (n === "seconds") return v > 0 ? fmtSec(3600 / v) : "—"; // stored as per-hour rate
  return formatIdleon(v);
}

/** @deprecated use formatGap (seconds boards are per-hour rates). delta = amount to change in the improving direction: "+" to add, "−" (U+2212) to subtract. */
export function formatDelta(delta: number, n: Notation, lowerIsBetter: boolean): string {
  return `${lowerIsBetter ? "−" : "+"}${formatMetric(Math.abs(delta), n)}`;
}

/** Gap from the player's stored value to the target's stored value. Seconds: time saved. */
export function formatGap(from: number, to: number, n: Notation): string {
  if (n === "seconds") return `−${fmtSec(3600 / from - 3600 / to)}`;
  return `+${formatMetric(to - from, n)}`;
}
