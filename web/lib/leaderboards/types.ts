// Mirrors Idleon Toolbox's /leaderboards/* responses.
export type Notation = "default" | "multiplier" | "seconds" | "bits";
export type MetaMetric = { key: string; label: string; notation: Notation; top: number; topTies: number; players: number; maxed: boolean; section: string };
export type MetaTab = { key: string; label: string; sections: { name: string; metrics: MetaMetric[] }[] };
export type LbMeta = { createdAt: number; totalPlayers: number; tabs: MetaTab[] };
export type RankEntry = { r: number; v: number; p: number; t: number; nr?: number; nv?: number };
export type LbPlayer = { createdAt: number; player: { mainChar: string; rank: number; compositeScore: number; profileAccess: string; mainClass: number; bestMetrics: unknown[] }; ranks: Record<string, RankEntry> };
export type BoardRow = { mainChar: string; value: number; rank: number; globalRank?: number };
export type LbBoard = { metric: string; createdAt: number; top: BoardRow[]; around: BoardRow[] };
