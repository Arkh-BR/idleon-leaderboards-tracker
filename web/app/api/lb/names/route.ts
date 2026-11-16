import { NextRequest, NextResponse } from "next/server";
import { lbProxy } from "@/lib/leaderboards/lbProxy";

export const runtime = "nodejs";
export const revalidate = 0;

// Autocomplete gets its own 150/day on top of the shared lb budget, so typing can't drain player lookups.
const NAMES_BUDGET = { name: "lb-names", cap: 150 };

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ players: [] });
  const res = await lbProxy<{ players: string[] }>(`names?q=${encodeURIComponent(q)}`, `names:${q.toLowerCase()}`, 10, undefined, NAMES_BUDGET);
  // Over a cap, autocomplete just stops suggesting (200, no names) instead of erroring.
  return res.status === 429 ? NextResponse.json({ players: [] }) : res;
}
