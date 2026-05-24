// Tier classification mirroring IT's segmentColors from
// parsers/world-4/tome.ts:
//   pct < 0.4  → bronze
//   pct < 0.75 → silver
//   pct < 0.999 → gold
//   else        → blue (capped / at max)
//
// Used in the Best Tome panel to color-code each task by progress.

export type TomeTier = "bronze" | "silver" | "gold" | "blue" | "missing";

export type TomeTierMeta = {
  label: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  // Hex color for inline use (e.g., progress bars).
  hex: string;
};

export const TIER_META: Record<TomeTier, TomeTierMeta> = {
  bronze: {
    label: "Bronze",
    textClass: "text-orange-300",
    bgClass: "bg-orange-900/30",
    borderClass: "border-orange-700/50",
    hex: "#ffc277",
  },
  silver: {
    label: "Silver",
    textClass: "text-zinc-300",
    bgClass: "bg-zinc-800/60",
    borderClass: "border-zinc-600",
    hex: "#d6dbe0",
  },
  gold: {
    label: "Gold",
    textClass: "text-yellow-300",
    bgClass: "bg-yellow-900/30",
    borderClass: "border-yellow-700/50",
    hex: "#FFD700",
  },
  blue: {
    label: "Maxed",
    textClass: "text-sky-300",
    bgClass: "bg-sky-900/30",
    borderClass: "border-sky-700/50",
    hex: "#56ccff",
  },
  missing: {
    label: "No data",
    textClass: "text-zinc-500",
    bgClass: "bg-zinc-900",
    borderClass: "border-zinc-800",
    hex: "#52525b",
  },
};

export function tierForPct(pct: number | null): TomeTier {
  if (pct === null || !isFinite(pct)) return "missing";
  if (pct < 0.4) return "bronze";
  if (pct < 0.75) return "silver";
  if (pct < 0.999) return "gold";
  return "blue";
}
