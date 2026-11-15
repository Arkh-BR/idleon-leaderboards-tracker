// Shared Idleon Toolbox fetch: agreed headers, in-memory cache and a daily cap per budget.
// Access agreed with IT's owner (2026-11-12): exact Origin (no trailing slash), a distinct UA per
// caller, caching, and a capped, logged number of upstream fetches a day.

export const SITE_HEADERS = {
  Origin: "https://arkh-idleon-trackers.vercel.app",
  "User-Agent": "Mozilla/5.0 (compatible; IdleonTrackersWeb/1.0)",
};
export const SCRAPER_HEADERS = {
  Origin: "https://arkh-idleon-trackers.vercel.app",
  "User-Agent":
    "Mozilla/5.0 (compatible; IdleonTrackersScraper/1.0; +https://github.com/Arkh-BR/idleon-leaderboards-tracker)",
};

export type Budget = { name: string; cap: number };
export type ItResult<T> =
  | { ok: true; data: T; cache: "hit" | "miss" }
  | { ok: false; status: number; error: string };

// ponytail: per server instance (resets on a cold start), so the real total can exceed the cap when
// several instances run at once; move the counter to a shared store if the logs show that happening.
const CACHE = new Map<string, { at: number; data: unknown }>();
const COUNTERS = new Map<string, { day: string; n: number }>();

export function __resetItFetchForTests(): void {
  CACHE.clear();
  COUNTERS.clear();
}

export async function itFetchJson<T>(
  url: string,
  opts: { cacheKey: string; ttlMs: number; budget: Budget; force?: boolean; accept?: (data: T) => boolean },
): Promise<ItResult<T>> {
  const { cacheKey, ttlMs, budget, force, accept } = opts;
  const cached = CACHE.get(cacheKey);
  if (!force && cached && Date.now() - cached.at < ttlMs) {
    return { ok: true, data: cached.data as T, cache: "hit" };
  }

  const day = new Date().toISOString().slice(0, 10);
  let c = COUNTERS.get(budget.name);
  if (!c || c.day !== day) COUNTERS.set(budget.name, (c = { day, n: 0 }));
  if (c.n >= budget.cap) return { ok: false, status: 429, error: "daily cap reached" };
  c.n++;
  console.log(`[api/${budget.name}] Idleon Toolbox fetch ${c.n}/${budget.cap} on ${day}`);

  try {
    const r = await fetch(url, { headers: SITE_HEADERS });
    if (r.status === 404) return { ok: false, status: 404, error: "HTTP 404" };
    if (!r.ok) return { ok: false, status: 502, error: `HTTP ${r.status}` };
    const data = (await r.json()) as T;
    if (!accept || accept(data)) CACHE.set(cacheKey, { at: Date.now(), data });
    return { ok: true, data, cache: "miss" };
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : String(e) };
  }
}
