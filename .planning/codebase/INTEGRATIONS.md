# Integrations

**Analysis Date:** 2026-06-01

## External APIs

**IdleonToolbox Public API**

- Base URL: `https://profiles.idleontoolbox.workers.dev/api/leaderboards`
- Purpose: Source of all 153 leaderboard rankings and player scores
- Authentication: None — fully public, no API key required
- Endpoints used:
  - `GET /api/leaderboards?leaderboard=<category>` — top-10 rankings per category
  - `GET /api/leaderboards?leaderboard=<category>&leaderboardUser=<player>` — specific player rank+score
- Headers: Spoofed `Referer: https://idleontoolbox.com/` and custom `User-Agent` to mimic browser requests
- Rate limiting: Not documented; project implements 15-minute client-side cache to reduce hammering
- Location in code: `web/app/api/leaderboards/route.ts`

**API Behavior Notes:**

- Returns two views per category: `public` (opted-in profiles only) and `anonymous` (full ranking with anon players)
- `&leaderboardUser=NAME` parameter is undocumented but discovered via source inspection
- Player name must match exactly (case-insensitive comparison in code)
- Anonymous profiles require `Anon#xxxxxx` format

## Third-Party Services

**Vercel**

- Purpose: Hosting and deployment platform
- Integration: One-click deploy button via `vercel.com/new/clone`
- Features used: Serverless Functions (API routes), Edge caching, Analytics
- Config: `next.config.mjs` optimized for Vercel static/serverless hybrid

**Vercel Analytics**

- Package: `@vercel/analytics` 2.0.1
- Purpose: Web traffic analytics
- Integration: Injected in root `layout.tsx` via `<Analytics />` component
- No custom events tracked

## Data Formats

**Leaderboard API Response (Top):**

```typescript
type TopResponse = Record<string, {
  public?: Record<string, TopEntry[]>;
  anonymous?: Record<string, TopEntry[]>;
}>;
```

**Leaderboard API Response (User):**

```typescript
type UserResponse = Record<string, TopEntry[] | TopEntry | undefined>;
```

**TopEntry:**

```typescript
type TopEntry = {
  mainChar?: string;
  rank?: number;
  [valueKey: string]: unknown; // dynamic value key per board
};
```

**Internal Normalized Format (BoardResult):**

```typescript
type BoardResult = {
  category: CategoryKey;
  categoryLabel: string;
  apiKey: string;
  label: string;
  myRank: number | null;
  myScore: number | null;
  top10: { name: string; score: number; rank: number }[];
};
```

## Configuration

**No environment variables required** — all config is inline:

- `API_BASE` constant in `route.ts`
- `CACHE_TTL_MS = 15 * 60 * 1000`
- `CATEGORY_OPTIONS` array in `LeaderboardsTable.tsx`
- Custom theme colors in `tailwind.config.ts`

**Proxy / CORS:**

- Next.js API route acts as a proxy to avoid CORS issues in browser direct calls
- Server-side `fetch()` bypasses browser CORS restrictions

## Rate Limiting & Caching

**Server-side cache:**

- In-memory `Map<string, CacheEntry>` with 15-minute TTL
- Cache key: `<player-lowercase>|pub` or `<player-lowercase>|all`
- Not persistent across deploys or serverless cold starts

**Client-side considerations:**

- Manual cache-busting via `?force=1` query param
- No Service Worker or offline support detected

---

_Integrations analysis: 2026-06-01_
_Update when external dependencies change_
