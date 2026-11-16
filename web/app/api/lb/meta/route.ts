import { lbProxy } from "@/lib/leaderboards/lbProxy";
import type { LbMeta } from "@/lib/leaderboards/types";

export const runtime = "nodejs";
export const revalidate = 0;

export const GET = () => lbProxy<LbMeta>("meta", "meta", 30);
