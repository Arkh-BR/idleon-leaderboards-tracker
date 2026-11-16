import { NextRequest, NextResponse } from "next/server";
import { itFetchJson } from "@/lib/leaderboards/itFetch";

// Server-side proxy for the IdleonToolbox "profiles" endpoint, which returns
// a public profile's raw save (the same "Copy for Support" envelope our
// engines consume — { data, charNames, companion, parsedData, … }). A proxy is
// needed because the IT API blocks direct cross-origin calls from the browser
// (same reason as /api/lb/*). Lets the Tome / Drop Rate / Talents
// pages load a save by player name instead of pasting the ~1.3 MB JSON.

export const runtime = "nodejs";
export const revalidate = 0;

const PROFILES_BASE =
  "https://profiles.idleontoolbox.workers.dev/api/profiles/";

// The save is large (~1.3 MB) and the three pages may re-fetch the same player
// on open, so cache per lowercased name. The IT data only refreshes ~once a
// day, so 15 min is plenty. Headers, cache and the 200/day cap live in itFetch.
// Private / anonymous / unknown profiles come back as `null` (or without the
// save envelope); those are not cached so a fixed privacy setting works at once.
const isSave = (save: unknown) =>
  !!save &&
  typeof save === "object" &&
  !!(save as { data?: unknown }).data &&
  Array.isArray((save as { charNames?: unknown }).charNames);

const CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET(req: NextRequest) {
  const player = (req.nextUrl.searchParams.get("player") || "").trim();
  if (!player) {
    return NextResponse.json({ error: "missing ?player=" }, { status: 400 });
  }
  const force = req.nextUrl.searchParams.get("force") === "1";
  const key = player.toLowerCase();

  const r = await itFetchJson<unknown>(
    `${PROFILES_BASE}?profile=${encodeURIComponent(player)}`,
    { cacheKey: `profile:${key}`, ttlMs: CACHE_TTL_MS, budget: { name: "profile", cap: 200 }, force, accept: isSave },
  );
  if (!r.ok && r.status === 429) {
    return NextResponse.json(
      { error: "Too many profile lookups today. Try again tomorrow, or paste the save manually below." },
      { status: 429 }
    );
  }
  if (!r.ok && r.status === 502) {
    return NextResponse.json({ error: `Failed to reach IdleonToolbox: ${r.error}` }, { status: 502 });
  }
  const save = r.ok ? r.data : null;

  // Surface a clear 404 the client can show.
  if (!isSave(save)) {
    return NextResponse.json(
      {
        error:
          "Profile not found or not public. Make sure the name is right and the profile is Public/Anonymous on IdleonToolbox — or paste the save manually below.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json(save, { headers: { "x-cache": r.ok ? r.cache : "miss" } });
}
