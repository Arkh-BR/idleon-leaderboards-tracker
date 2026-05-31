import { NextRequest, NextResponse } from "next/server";

// Server-side proxy for the IdleonToolbox "profiles" endpoint, which returns
// a public profile's raw save (the same "Copy for Support" envelope our
// engines consume — { data, charNames, companion, parsedData, … }). A proxy is
// needed because the IT API blocks direct cross-origin calls from the browser
// (same reason as /api/leaderboards). Lets the Tome / Drop Rate / Talents
// pages load a save by player name instead of pasting the ~1.3 MB JSON.

export const runtime = "nodejs";
export const revalidate = 0;

const PROFILES_BASE =
  "https://profiles.idleontoolbox.workers.dev/api/profiles/";

// The save is large (~1.3 MB) and the three pages may re-fetch the same player
// on open, so cache per lowercased name. The IT data only refreshes ~once a
// day, so 15 min is plenty.
type CacheEntry = { at: number; data: unknown };
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET(req: NextRequest) {
  const player = (req.nextUrl.searchParams.get("player") || "").trim();
  if (!player) {
    return NextResponse.json({ error: "missing ?player=" }, { status: 400 });
  }
  const force = req.nextUrl.searchParams.get("force") === "1";
  const key = player.toLowerCase();

  const cached = CACHE.get(key);
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, { headers: { "x-cache": "hit" } });
  }

  let save: unknown;
  try {
    const url = `${PROFILES_BASE}?profile=${encodeURIComponent(player)}`;
    const r = await fetch(url, {
      headers: {
        Referer: "https://idleontoolbox.com/",
        "User-Agent": "Mozilla/5.0 (compatible; IdleonTrackersWeb/1.0)",
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    save = await r.json();
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to reach IdleonToolbox: ${
        e instanceof Error ? e.message : String(e)
      }` },
      { status: 502 }
    );
  }

  // Private / anonymous / unknown profiles come back as `null` (or without the
  // save envelope). Surface a clear 404 the client can show.
  const ok =
    save &&
    typeof save === "object" &&
    (save as { data?: unknown }).data &&
    Array.isArray((save as { charNames?: unknown }).charNames);
  if (!ok) {
    return NextResponse.json(
      {
        error:
          "Profile not found or not public. Make sure the name is right and the profile is Public/Anonymous on IdleonToolbox — or paste the save manually below.",
      },
      { status: 404 }
    );
  }

  CACHE.set(key, { at: Date.now(), data: save });
  return NextResponse.json(save, { headers: { "x-cache": "miss" } });
}
