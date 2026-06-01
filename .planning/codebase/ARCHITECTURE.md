# Architecture

**Analysis Date:** 2026-06-01

## Pattern Overview

**Overall:** Full-stack Next.js App Router application with feature-based organization and API-heavy backend routes.

**Key Characteristics:**

- Server-side API route (`app/api/leaderboards/route.ts`) acts as a caching proxy to third-party API
- Client-side React components with local state and localStorage persistence
- Feature-first directory layout (leaderboards, tome, drop-rate, talents-level, sheets)
- No database — all state lives in browser (localStorage) and in-memory server cache
- Static export friendly (no server-side sessions or DB)

## Layers

**API Route Layer:**

- Purpose: Proxy and cache external IdleonToolbox API data
- Contains: Route handlers for `/api/leaderboards`, `/api/profile`
- Location: `app/api/leaderboards/route.ts`, `app/api/profile/route.ts`
- Depends on: External third-party API (`profiles.idleontoolbox.workers.dev`)
- Used by: Client-side pages fetching via `fetch()`

**Client Page Layer:**

- Purpose: Render UI and orchestrate data fetching
- Contains: Page components (Server Components + Client Components via composition)
- Location: `app/*/page.tsx` files
- Depends on: API routes, React components, utility libs
- Used by: Browser / Next.js router

**Component Layer:**

- Purpose: Reusable UI components and feature-specific views
- Contains: Tables, dashboards, navigation, cards
- Location: `components/*.tsx`, `components/<feature>/*.tsx`
- Depends on: Utility libraries, React hooks
- Used by: Client pages and other components

**Utility/Library Layer:**

- Purpose: Shared logic for data transformation, formatting, ranking, and snapshots
- Contains: Formatting helpers, rank calculations, snapshot management, registry of game data
- Location: `lib/*.ts`, `lib/<feature>/*.ts`, `lib/it/**/*.ts`
- Depends on: TypeScript built-ins, browser APIs (localStorage)
- Used by: Components, pages, and API routes

## Data Flow

**Leaderboards Data Fetch:**

1. Browser loads `/leaderboards` page
2. Client component (`LeaderboardsPageClient.tsx`) mounts and calls internal API
3. `GET /api/leaderboards?player=NAME` checks in-memory `CACHE` (15 min TTL)
4. Cache miss → server spawns parallel `fetch()` calls per category (7 categories)
5. Each category fetches top-10 rankings + user-specific rank via IdleonToolbox API
6. Server normalizes and merges responses into `BoardResult[]`
7. Response returned to client with `x-cache: miss/hit` header
8. Client renders `LeaderboardsTable` and `Dashboard` from fetched data

**Snapshot / Delta Flow:**

1. User triggers "Save snapshot" → `saveSnapshot()` writes to localStorage
2. Key shape: `idleon-leaderboards.lb.ptsSnapshot.<player-lower>`
3. On next load, `computeDelta()` compares current rank/score vs snapshot
4. Dashboard shows net rank movement KPIs

**State Management:**

- Server: In-memory `Map<string, CacheEntry>` — ephemeral, resets on deploy
- Client: React `useState` + `useMemo` for UI state, `localStorage` for snapshots
- No external state library (Redux, Zustand, etc.)

## Key Abstractions

**BoardResult:**

- Purpose: Unified leaderboard result combining player rank, score, and top-10 list
- Structure: `{ category, categoryLabel, apiKey, label, myRank, myScore, top10[] }`
- Location: `app/api/leaderboards/route.ts` — used across API, components, and snapshot logic

**LbSnapshot:**

- Purpose: Capture per-player leaderboard state at a point in time for delta tracking
- Structure: `{ savedAt, player, boards: Record<string, { rank, score }> }`
- Location: `lib/lbSnapshot.ts` — consumed by `LeaderboardsPageClient.tsx` and Dashboard

**CategorySpec / BoardSpec:**

- Purpose: Registry of all 153 leaderboards mapped to IdleonToolbox API keys and human labels
- Structure: `CategorySpec[]` with nested `BoardSpec[]`
- Location: `lib/registry.ts` — single source of truth for all supported boards

## Entry Points

**Web App Entry:**

- Location: `web/app/layout.tsx`
- Triggers: Any page navigation in the Next.js app
- Responsibilities: Root layout with Inter font, TopNav, Vercel Analytics wrapper

**API Entry:**

- Location: `web/app/api/leaderboards/route.ts` → `GET` handler
- Triggers: Client-side `fetch()` from `LeaderboardsPageClient.tsx`
- Responsibilities: Validate `?player=` param, check cache, proxy to IdleonToolbox API

**Spreadsheet Version Entry:**

- Location: `Code.gs` (Google Apps Script)
- Triggers: User runs "Refresh data" from Google Sheets custom menu
- Responsibilities: Fetch API data and populate spreadsheet cells

## Error Handling

**Strategy:** Per-category graceful degradation with error aggregation.

**Patterns:**

- API route uses `Promise.allSettled`-like pattern: errors per category are collected in `errors[]` array and returned alongside valid data
- Client receives both `boards` and `errors`, rendering whichever succeeded
- `try/catch` at category level prevents one failed category from breaking all others

## Cross-Cutting Concerns

**Caching:**

- In-memory `Map` in API route with 15-minute TTL
- No Redis or persistent cache — purely per-process

**Analytics:**

- Vercel Analytics injected globally in `layout.tsx`
- No custom event tracking observed

**Authentication:**

- None required — reads entirely from public IdleonToolbox API
- `Referer` and `User-Agent` headers spoofed to mimic legitimate traffic

**Formatting:**

- `lib/format.ts` centralizes Idleon-style number formatting (M/B/T/Q suffixes) and relative time strings

---

_Architecture analysis: 2026-06-01_
_Update when major patterns change_
