import type { Metadata } from "next";
import LbPage from "@/components/leaderboards/LbPage";
import { boardCount } from "@/lib/leaderboards/meta";

export const metadata: Metadata = {
  title: "IT Leaderboards Tracker",
  description: `Track your position across all ${boardCount()} Idleon Toolbox leaderboards — live data, no spreadsheet.`,
};

export default function LeaderboardsPage() {
  return <LbPage />;
}
