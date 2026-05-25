import type { Metadata } from "next";
import LeaderboardsPageClient from "./LeaderboardsPageClient";

export const metadata: Metadata = {
  title: "IT Leaderboards Tracker",
  description:
    "Track your position across all 153 IdleonToolbox leaderboards — live data, no spreadsheet.",
};

export default function LeaderboardsPage() {
  return <LeaderboardsPageClient />;
}
