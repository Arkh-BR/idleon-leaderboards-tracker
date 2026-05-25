export function rankBgClass(rank: number | null): string {
  if (rank === null) return "bg-zinc-800 text-zinc-400";
  if (rank === 1) return "bg-[#FFD700] text-[#1a1a2e] font-bold";
  if (rank === 2) return "bg-[#C0C0C0] text-[#1a1a2e] font-bold";
  if (rank === 3) return "bg-[#CD7F32] text-white font-bold";
  if (rank <= 10) return "bg-green-400 text-[#1a1a2e] font-semibold";
  if (rank <= 50) return "bg-green-700/40 text-green-200";
  if (rank <= 100) return "bg-yellow-700/40 text-yellow-200";
  if (rank <= 200) return "bg-orange-700/40 text-orange-200";
  if (rank <= 500) return "bg-red-700/40 text-red-200";
  return "bg-red-900/60 text-red-300";
}

export type Tier =
  | "top10"
  | "top11_50"
  | "top51_100"
  | "top101_200"
  | "rank201_500"
  | "rank500plus";

// IT leaderboards always rank a player somewhere — there's no "unranked"
// tier. If rank is null for any reason (API hiccup, board missing), bucket
// it with the worst tier so we don't silently lose the row.
export function tierOf(rank: number | null): Tier {
  if (rank === null) return "rank500plus";
  if (rank <= 10) return "top10";
  if (rank <= 50) return "top11_50";
  if (rank <= 100) return "top51_100";
  if (rank <= 200) return "top101_200";
  if (rank <= 500) return "rank201_500";
  return "rank500plus";
}

export const TIER_LABELS: Record<Tier, string> = {
  top10: "Top 10",
  top11_50: "Top 11-50",
  top51_100: "Top 51-100",
  top101_200: "Top 101-200",
  rank201_500: "Rank 201-500",
  rank500plus: "Rank 500+",
};

export const TIER_COLORS: Record<Tier, string> = {
  top10: "bg-gold text-ink",
  top11_50: "bg-green-400 text-ink",
  top51_100: "bg-yellow-300 text-ink",
  top101_200: "bg-orange-400 text-ink",
  rank201_500: "bg-red-500 text-white",
  rank500plus: "bg-red-900 text-red-100",
};
