import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES, type CategoryKey } from "@/lib/registry";

export const runtime = "nodejs";
export const revalidate = 0;

const API_BASE = "https://profiles.idleontoolbox.workers.dev/api/leaderboards";

type TopEntry = { mainChar?: string; rank?: number; [k: string]: unknown };
// Top-only response: { [category]: { public: { [boardKey]: TopEntry[] } } }
// User response:     { [boardKey]: TopEntry[] | TopEntry } — depends on category
type TopResponse = Record<string, { public?: Record<string, TopEntry[]> } | undefined>;
type UserResponse = Record<string, TopEntry[] | TopEntry | undefined>;

export type BoardResult = {
  category: CategoryKey;
  categoryLabel: string;
  apiKey: string;
  label: string;
  myRank: number | null;
  myScore: number | null;
  top10: { name: string; score: number; rank: number }[];
};

export type LeaderboardsResponse = {
  player: string;
  fetchedAt: number;
  boards: BoardResult[];
  errors: { category: string; message: string }[];
};

type CacheEntry = { at: number; data: LeaderboardsResponse };
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function valueKeyOf(entry: TopEntry): string | null {
  for (const k of Object.keys(entry)) {
    if (k !== "mainChar" && k !== "rank") return k;
  }
  return null;
}

async function fetchCategoryTop(category: CategoryKey): Promise<Record<string, TopEntry[]>> {
  const url = `${API_BASE}?leaderboard=${encodeURIComponent(category)}`;
  const r = await fetch(url, {
    headers: {
      Referer: "https://idleontoolbox.com/",
      "User-Agent": "Mozilla/5.0 (compatible; IdleonLeaderboardsWeb/1.0)",
    },
  });
  if (!r.ok) throw new Error(`top ${category}: HTTP ${r.status}`);
  const data = (await r.json()) as TopResponse;
  return data[category]?.public ?? {};
}

async function fetchCategoryUser(
  category: CategoryKey,
  player: string
): Promise<UserResponse> {
  const url = `${API_BASE}?leaderboard=${encodeURIComponent(category)}&leaderboardUser=${encodeURIComponent(player)}`;
  const r = await fetch(url, {
    headers: {
      Referer: "https://idleontoolbox.com/",
      "User-Agent": "Mozilla/5.0 (compatible; IdleonLeaderboardsWeb/1.0)",
    },
  });
  if (!r.ok) throw new Error(`user ${category}: HTTP ${r.status}`);
  return (await r.json()) as UserResponse;
}

export async function GET(req: NextRequest) {
  const player = (req.nextUrl.searchParams.get("player") || "").trim();
  if (!player) {
    return NextResponse.json({ error: "missing ?player=" }, { status: 400 });
  }
  const force = req.nextUrl.searchParams.get("force") === "1";
  const key = player.toLowerCase();
  const cached = CACHE.get(key);
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: { "x-cache": "hit" },
    });
  }

  const playerLc = player.toLowerCase();
  const errors: { category: string; message: string }[] = [];

  const settled = await Promise.all(
    CATEGORIES.map(async (cat) => {
      try {
        const [top, user] = await Promise.all([
          fetchCategoryTop(cat.key),
          fetchCategoryUser(cat.key, player),
        ]);
        return { cat, top, user };
      } catch (e) {
        errors.push({
          category: cat.key,
          message: e instanceof Error ? e.message : String(e),
        });
        return {
          cat,
          top: {} as Record<string, TopEntry[]>,
          user: {} as UserResponse,
        };
      }
    })
  );

  const boards: BoardResult[] = [];
  for (const { cat, top, user } of settled) {
    for (const board of cat.boards) {
      const topList = top[board.apiKey] ?? [];
      const userRaw = user[board.apiKey];
      const userList: TopEntry[] = Array.isArray(userRaw)
        ? userRaw
        : userRaw && typeof userRaw === "object"
        ? [userRaw]
        : [];

      let myRank: number | null = null;
      let myScore: number | null = null;
      const userEntry = userList.find(
        (e) => String(e.mainChar || "").toLowerCase() === playerLc
      );
      if (userEntry) {
        myRank = typeof userEntry.rank === "number" ? userEntry.rank : null;
        const vk = valueKeyOf(userEntry);
        if (vk) {
          const raw = userEntry[vk];
          myScore = typeof raw === "number" ? raw : Number(raw) || null;
        }
      }

      const top10 = topList.slice(0, 10).map((entry, i) => {
        const vk = valueKeyOf(entry);
        const score = vk ? Number(entry[vk]) : 0;
        return {
          name: String(entry.mainChar || ""),
          score: Number.isFinite(score) ? score : 0,
          rank: typeof entry.rank === "number" ? entry.rank : i + 1,
        };
      });

      boards.push({
        category: cat.key,
        categoryLabel: cat.label,
        apiKey: board.apiKey,
        label: board.label,
        myRank,
        myScore,
        top10,
      });
    }
  }

  const data: LeaderboardsResponse = {
    player,
    fetchedAt: Date.now(),
    boards,
    errors,
  };
  CACHE.set(key, { at: Date.now(), data });

  return NextResponse.json(data, {
    headers: { "x-cache": "miss" },
  });
}
