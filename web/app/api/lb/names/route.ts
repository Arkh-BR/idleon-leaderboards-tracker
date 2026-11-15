import { NextRequest, NextResponse } from "next/server";
import { lbProxy } from "@/lib/leaderboards/lbProxy";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ players: [] });
  return lbProxy<{ players: string[] }>(`names?q=${encodeURIComponent(q)}`, `names:${q.toLowerCase()}`, 10);
}
