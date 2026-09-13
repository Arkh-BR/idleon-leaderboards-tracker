import type { Metadata } from "next";
import LeaderboardsPageClient from "./LeaderboardsPageClient";
import { flatBoards } from "@/lib/registry";

export const metadata: Metadata = {
  title: "IT Leaderboards Tracker",
  description: `Track your position across all ${flatBoards().length} IdleonToolbox leaderboards — live data, no spreadsheet.`,
};

export default function LeaderboardsPage() {
  return <LeaderboardsPageClient />;
}
