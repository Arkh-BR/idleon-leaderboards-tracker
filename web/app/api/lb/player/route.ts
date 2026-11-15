import { NextRequest, NextResponse } from "next/server";
import { lbProxy } from "@/lib/leaderboards/lbProxy";
import type { LbPlayer } from "@/lib/leaderboards/types";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get("name") || "").trim();
  if (!name) return NextResponse.json({ error: "missing ?name=" }, { status: 400 });
  return lbProxy<LbPlayer>(`player?name=${encodeURIComponent(name)}`, `player:${name.toLowerCase()}`, 15,
    "Player not found. Check the name or make the profile public on Idleon Toolbox.");
}
