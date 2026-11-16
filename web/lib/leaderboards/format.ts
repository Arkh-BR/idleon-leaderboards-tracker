import { formatIdleon } from "@/lib/format";
import type { Notation } from "./types";

// Under 1 s (sproutSpeed's rates are in the millions) 3 significant digits, else 3 decimals up to 5 s, then 1.
const fmtSec = (t: number) => `${t < 1 ? t.toPrecision(3) : t.toFixed(t < 5 ? 3 : 1)}s`;

export function formatMetric(v: number, n: Notation): string {
  if (n === "multiplier") return `${v.toFixed(v < 10 ? 4 : 2)}x`;
  if (n === "seconds") return v > 0 ? fmtSec(3600 / v) : "—"; // stored as per-hour rate
  return formatIdleon(v);
}

/** Gap from the player's stored value to the target's stored value. Seconds: time saved. */
export function formatGap(from: number, to: number, n: Notation): string {
  if (n === "seconds") return `−${fmtSec(3600 / from - 3600 / to)}`;
  return `+${formatMetric(to - from, n)}`;
}
