// Shared helpers for the top-player scrapers: gather the candidate player
// list from the IT leaderboards API and fetch a public profile's raw save
// from the IT profiles endpoint (which our corgan engine consumes directly
// — see memory/it-profiles-save-endpoint).

import { CATEGORIES } from "../../lib/registry";

const IT_LEADERBOARDS = "https://profiles.idleontoolbox.workers.dev/api/leaderboards";
const IT_PROFILES = "https://profiles.idleontoolbox.workers.dev/api/profiles/";

export const IT_HEADERS = {
  Referer: "https://idleontoolbox.com/",
  "User-Agent":
    "Mozilla/5.0 (compatible; IdleonTrackersScraper/1.0; +https://github.com/Arkh-BR/idleon-leaderboards-tracker)",
};

type TopEntry = { mainChar?: string; rank?: number; [k: string]: unknown };
type CategoryTopResponse = Record<
  string,
  { public?: Record<string, TopEntry[]> } | undefined
>;

function isAnonymous(name: string): boolean {
  return name.startsWith("Anon#") || name.startsWith("Anon ") || !name.trim();
}

async function fetchCategoryTop(
  category: string
): Promise<Record<string, TopEntry[]>> {
  const url = `${IT_LEADERBOARDS}?leaderboard=${encodeURIComponent(category)}`;
  const r = await fetch(url, { headers: IT_HEADERS });
  if (!r.ok) throw new Error(`top ${category}: HTTP ${r.status}`);
  const data = (await r.json()) as CategoryTopResponse;
  return data[category]?.public ?? {};
}

/**
 * Build the candidate player set: the #1 of every leaderboard plus the top
 * 10 of totalTomePoints. Anonymous players are excluded (their profiles
 * aren't publicly viewable). Optionally capped to `limit` names.
 */
export async function gatherCandidates(limit?: number): Promise<string[]> {
  const candidates = new Set<string>();
  const tomeBoard: TopEntry[] = [];

  for (const cat of CATEGORIES) {
    try {
      const boards = await fetchCategoryTop(cat.key);
      for (const board of cat.boards) {
        const list = boards[board.apiKey] ?? [];
        const top1 = list[0]?.mainChar?.trim();
        if (top1 && !isAnonymous(top1)) candidates.add(top1);
        if (board.apiKey === "totalTomePoints") tomeBoard.push(...list);
      }
    } catch (e) {
      console.warn(`  × category ${cat.key} failed:`, (e as Error).message);
    }
  }
  for (const entry of tomeBoard.slice(0, 10)) {
    const name = entry.mainChar?.trim();
    if (name && !isAnonymous(name)) candidates.add(name);
  }

  let names = [...candidates].sort();
  if (limit && limit > 0) names = names.slice(0, limit);
  return names;
}

/**
 * Fetch a public profile's raw save JSON. Returns null on any error or a
 * non-save-shaped response so callers can skip gracefully.
 */
export async function fetchProfileSave(name: string): Promise<any | null> {
  const url = `${IT_PROFILES}?profile=${encodeURIComponent(name)}`;
  try {
    const r = await fetch(url, { headers: IT_HEADERS });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || typeof j !== "object" || !j.data || !Array.isArray(j.charNames)) {
      return null;
    }
    return j;
  } catch {
    return null;
  }
}
