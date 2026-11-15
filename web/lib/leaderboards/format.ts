import { formatIdleon } from "@/lib/format";
import type { Notation } from "./types";

export function formatMetric(v: number, n: Notation): string {
  if (n === "multiplier") return `${v.toFixed(v < 10 ? 4 : 2)}x`;
  if (n === "seconds") return `${v.toFixed(v < 5 ? 3 : 1)}s`;
  return formatIdleon(v);
}

/** delta = amount to change in the improving direction: "+" to add, "−" (U+2212) to subtract. */
export function formatDelta(delta: number, n: Notation, lowerIsBetter: boolean): string {
  return `${lowerIsBetter ? "−" : "+"}${formatMetric(Math.abs(delta), n)}`;
}
