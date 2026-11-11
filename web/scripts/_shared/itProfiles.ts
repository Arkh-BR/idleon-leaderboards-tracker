// Shared helpers for the top-player scrapers: gather the candidate player
// list from the IT leaderboards API and fetch a public profile's raw save
// from the IT profiles endpoint (the lib/game collectors read it as a save
// envelope).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES } from "../../lib/registry";
import { isDenylistedPlayer, hackedSaveReason } from "./hackers";

const IT_LEADERBOARDS = "https://profiles.idleontoolbox.workers.dev/api/leaderboards";
const IT_PROFILES = "https://profiles.idleontoolbox.workers.dev/api/profiles/";

const USER_AGENT = "Mozilla/5.0 (compatible; IdleonTrackersScraper/1.0; +https://github.com/Arkh-BR/idleon-leaderboards-tracker)";
/** What we send to the leaderboards. */
export const IT_HEADERS = { "User-Agent": USER_AGENT };
/**
 * What we send to the profiles: the owner of Idleon Toolbox locked profile reads to known origins (Workers bill, 2026-11) and allowlisted
 * our site's origin for this job (2026-11-11). Keep the User-Agent as it is, and keep the volume low: one fetch per profile per run,
 * shared by every collector (scripts/fetch-top-profiles.ts). Ask the owner before it grows past ~2,000 requests a day.
 */
const PROFILE_HEADERS = { Origin: "https://arkh-idleon-trackers.vercel.app", "User-Agent": USER_AGENT };

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
 * 10 of one focus board. Mirrors the Tome collector's logic; `focusBoard`
 * picks which ranking contributes its top 10 — "totalTomePoints" for the
 * Tome scraper, "dropRate" for the DR collector, etc. Anonymous players are
 * excluded (their profiles aren't publicly viewable). Optionally capped to
 * `limit` names.
 */
export async function gatherCandidates(
  opts: { limit?: number; focusBoard?: string | readonly string[] } = {}
): Promise<string[]> {
  const { limit, focusBoard = "totalTomePoints" } = opts;
  // several focus boards: the top 10 of each (the shared fetch covers every collector's list at once)
  const focusBoards = new Set(typeof focusBoard === "string" ? [focusBoard] : focusBoard);
  const candidates = new Set<string>();
  const focusLists = new Map<string, TopEntry[]>();

  for (const cat of CATEGORIES) {
    try {
      const boards = await fetchCategoryTop(cat.key);
      for (const board of cat.boards) {
        const list = boards[board.apiKey] ?? [];
        const top1 = list[0]?.mainChar?.trim();
        if (top1 && !isAnonymous(top1)) candidates.add(top1);
        if (focusBoards.has(board.apiKey)) focusLists.set(board.apiKey, [...(focusLists.get(board.apiKey) ?? []), ...list]);
      }
    } catch (e) {
      console.warn(`  × category ${cat.key} failed:`, (e as Error).message);
    }
  }
  // Top 10 of each focus board specifically.
  for (const focusList of focusLists.values()) {
    for (const entry of focusList.slice(0, 10)) {
      const name = entry.mainChar?.trim();
      if (name && !isAnonymous(name)) candidates.add(name);
    }
  }

  // Drop known hacked/cheated profiles before they reach any collector.
  let names = [...candidates].filter((n) => !isDenylistedPlayer(n)).sort();
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
    const r = await fetch(url, { headers: PROFILE_HEADERS });
    if (!r.ok) {
      console.warn(`\n  · ${name}: HTTP ${r.status}`);
      return null;
    }
    const j = await r.json();
    if (!j || typeof j !== "object" || !j.data || !Array.isArray(j.charNames)) {
      return null;
    }
    // Sanity guard: discard saves that trip a cheat sentinel (e.g. impossible
    // megafeather counts) so a single hacked profile can't poison the
    // best-per-path snapshots.
    const reason = hackedSaveReason(j);
    if (reason) {
      console.warn(`\n  · ${name}: hacked save skipped (${reason})`);
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

/** The players a --saves-dir run reads: every <name>.json in `dir` (written by scripts/fetch-top-profiles.ts), sorted. */
export function savedPlayers(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
}

/** A saved profile, with the same shape and hacked-save checks as fetchProfileSave; null when it doesn't pass. */
export function readProfileSave(dir: string, name: string): any | null {
  try {
    const j = JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8").replace(/^\uFEFF/, ""));
    return j && typeof j === "object" && j.data && Array.isArray(j.charNames) && !hackedSaveReason(j) ? j : null;
  } catch {
    return null;
  }
}
