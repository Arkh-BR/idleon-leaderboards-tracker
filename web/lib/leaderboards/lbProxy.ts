import { NextResponse } from "next/server";
import { itFetchJson, type Budget } from "./itFetch";

export const LB_BASE = "https://profiles.idleontoolbox.workers.dev/api/leaderboards";
const BUDGET: Budget = { name: "lb", cap: 500 };
const MIN = 60 * 1000;

// Shared by the four /api/lb/* routes: one budget, JSON out, `{error}` with the upstream status.
export async function lbProxy<T>(path: string, cacheKey: string, ttlMin: number, notFound?: string) {
  const r = await itFetchJson<T>(`${LB_BASE}/${path}`, { cacheKey: `lb:${cacheKey}`, ttlMs: ttlMin * MIN, budget: BUDGET });
  if (r.ok) return NextResponse.json(r.data, { headers: { "x-cache": r.cache } });
  const error =
    r.status === 429 ? "Too many lookups today. Try again tomorrow."
    : r.status === 404 && notFound ? notFound
    : r.status === 502 ? `Failed to reach IdleonToolbox: ${r.error}`
    : r.error;
  return NextResponse.json({ error }, { status: r.status });
}
