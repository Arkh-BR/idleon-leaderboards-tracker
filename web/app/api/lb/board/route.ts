import { NextRequest, NextResponse } from "next/server";
import { lbProxy } from "@/lib/leaderboards/lbProxy";
import type { LbBoard } from "@/lib/leaderboards/types";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const metric = (p.get("metric") || "").trim();
  if (!metric) return NextResponse.json({ error: "missing ?metric=" }, { status: 400 });
  const q = new URLSearchParams({ metric, limit: "100" });
  const around = (p.get("around") || "").trim();
  if (around) q.set("around", around);
  if (p.get("public") === "1") q.set("public", "1");
  return lbProxy<LbBoard>(`board?${q}`, `board:${q.toString().toLowerCase()}`, 30);
}
