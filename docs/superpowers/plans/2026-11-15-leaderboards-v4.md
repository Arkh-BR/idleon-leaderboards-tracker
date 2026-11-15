# Leaderboards v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `/leaderboards` to Idleon Toolbox's new API, show the 220 boards in IT's tabs and sections with rank, top %, to-climb and to-top-100, and upgrade the Dashboard.

**Architecture:**
- Thin cached proxy routes (`app/api/lb/*`) sit over IT's `/leaderboards/{meta,player,board,names}` and share one fetch helper, which holds the agreed headers, a cache and a daily cap.
- A daily cron writes `lib/leaderboards/snapshot.ts` (the meta plus the #10 and #100 cutoffs of every board).
- Pure functions in `lib/leaderboards/` compute everything the UI shows. New components in `components/leaderboards/` replace `LeaderboardsTable` and `Dashboard`.

**Tech Stack:** Next.js (app router, nodejs runtime), React, TypeScript, Tailwind, vitest + Testing Library (happy-dom), GitHub Actions, tsx.

**Spec:** `docs/superpowers/specs/2026-11-15-leaderboards-v4-design.md`

## Global Constraints

- Every IT request sends `Origin: https://arkh-idleon-trackers.vercel.app`, exact and with no trailing slash, and never an idleontoolbox.com Origin or Referer.
- The User-Agent is `Mozilla/5.0 (compatible; IdleonTrackersWeb/1.0)` in site routes and `Mozilla/5.0 (compatible; IdleonTrackersScraper/1.0; +https://github.com/Arkh-BR/idleon-leaderboards-tracker)` in the cron.
- Daily caps: the `lb/*` routes share 500 upstream fetches a day and `/api/profile` keeps 200. Cache hits don't count. Each fetch logs `[api/lb] Idleon Toolbox fetch n/500 on <YYYY-MM-DD>`.
- Cache TTLs: meta 30 min, player 15 min, board 30 min, names 10 min.
- All site text is in English. The visual stays the site's own (dark zinc/emerald Tailwind); no IT code or styling is copied (IT is GPL, we are MIT).
- Never run `npm run dev`. Verify with `npx tsc --noEmit -p .`, `npx vitest run <paths>`, and the Vercel preview.
- Repo rules:
  - Work on branch `feat/leaderboards-v4` and stage files by path, never with `git add -A`.
  - Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Never merge to main without the user's explicit OK.
- Tests that import modules calling `fetch` must stub it (`vi.stubGlobal("fetch", ...)`) and run in the default environment. A `@vitest-environment node` pragma breaks `setupTests.ts`.
- The cron runs on Node 24, under `timeout -s KILL`, and commits only its own file.

## Review Focus

1. **Lower-is-better boards** (`fastestEggTime`, `fastestArenaRound100`, `sproutSpeed`; `notation: "seconds"`). Every gap must point the right way: "−0.4s" to pass, not "+". This is covered in Task 3's tests.
2. **Rank 1 or tied #1** (no `nr`/`nv`). To climb shows "#1" or "tied #1 (N)", never NaN, and nothing crashes. This is covered in Task 3.
3. **A board in `/meta` but missing from the snapshot** (it appeared after the last cron). To top 100 shows "—" with the tooltip. This is covered in Task 3 and Task 7.
4. **`/player` 404 and 429**. These show the spec's messages, and the previous player's data is cleared, not left on screen. This is covered in Task 2 and Task 6.
5. **The same IT `createdAt` loaded twice.** The "since last visit" baseline and the history must not change. This is covered in Task 4.

---

### Task 1: Shared IT fetch helper

**Files:**
- Create: `web/lib/leaderboards/itFetch.ts`
- Modify: `web/app/api/profile/route.ts` (use the helper; same behavior)
- Test: `web/__tests__/lib/leaderboards/itFetch.test.ts`; `web/__tests__/api/profileRoute.test.ts` must still pass unchanged

**Interfaces:**
- Produces:
  ```ts
  export const SITE_HEADERS: { Origin: string; "User-Agent": string };
  export const SCRAPER_HEADERS: { Origin: string; "User-Agent": string };
  export type Budget = { name: string; cap: number };            // counter per name, resets on UTC day change
  export type ItResult<T> = { ok: true; data: T; cache: "hit" | "miss" } | { ok: false; status: number; error: string };
  export function itFetchJson<T>(url: string, opts: { cacheKey: string; ttlMs: number; budget: Budget; force?: boolean }): Promise<ItResult<T>>;
  export function __resetItFetchForTests(): void;
  ```
  - IT 404 maps to `{ok:false,status:404}`; any other non-ok to `{ok:false,status:502,error:"HTTP <n>"}`.
  - Over the cap it returns `{ok:false,status:429}` without fetching.
  - The cache lives in module memory per `cacheKey`. A 404 is never cached.

- [ ] **Step 1:** Write the failing tests:
  - `sends SITE_HEADERS`: the Origin is exactly `https://arkh-idleon-trackers.vercel.app`, the UA contains `IdleonTrackersWeb/1.0`, and there is no Referer;
  - `cache hit skips fetch and the counter`;
  - `429 after cap` with `{name:"t",cap:2}`: 2 misses, then a third distinct key gives 429 and `fetch` was called twice;
  - `404 passes through and is not cached`;
  - `500 becomes 502 "HTTP 500"`.
- [ ] **Step 2:** Run `npx vitest run __tests__/lib/leaderboards/itFetch.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `itFetch.ts`. The log line is `` `[api/${budget.name}] Idleon Toolbox fetch ${n}/${cap} on ${day}` ``.
- [ ] **Step 4:** Refactor `app/api/profile/route.ts` onto `itFetchJson` with `budget {name:"profile",cap:200}`, ttl 15 min, and `force`. Keep its 400/404/429/502 messages exactly as now.
- [ ] **Step 5:** Run `npx vitest run __tests__/lib/leaderboards __tests__/api` and `npx tsc --noEmit -p .`. Expected: PASS.
- [ ] **Step 6:** Commit `refactor(api): shared Idleon Toolbox fetch helper (headers, cache, daily cap)`.

### Task 2: `lb/*` proxy routes

**Files:**
- Create: `web/app/api/lb/meta/route.ts`, `web/app/api/lb/player/route.ts`, `web/app/api/lb/board/route.ts`, `web/app/api/lb/names/route.ts`, `web/lib/leaderboards/types.ts`
- Test: `web/__tests__/api/lbRoutes.test.ts`

**Interfaces:**
- Consumes: Task 1 `itFetchJson`, `SITE_HEADERS`.
- Produces `types.ts`, mirroring IT exactly:
  ```ts
  export type Notation = "default" | "multiplier" | "seconds" | "bits";
  export type MetaMetric = { key: string; label: string; notation: Notation; top: number; topTies: number; players: number; maxed: boolean; section: string };
  export type MetaTab = { key: string; label: string; sections: { name: string; metrics: MetaMetric[] }[] };
  export type LbMeta = { createdAt: number; totalPlayers: number; tabs: MetaTab[] };
  export type RankEntry = { r: number; v: number; p: number; t: number; nr?: number; nv?: number };
  export type LbPlayer = { createdAt: number; player: { mainChar: string; rank: number; compositeScore: number; profileAccess: string; mainClass: number; bestMetrics: unknown[] }; ranks: Record<string, RankEntry> };
  export type BoardRow = { mainChar: string; value: number; rank: number; globalRank?: number };
  export type LbBoard = { metric: string; createdAt: number; top: BoardRow[]; around: BoardRow[] };
  ```
- Routes (GET; JSON body; errors as `{error}` with the status from `ItResult`):
  - `/api/lb/meta`: upstream `/leaderboards/meta`, 30 min.
  - `/api/lb/player?name=`: 400 without a name; upstream `/leaderboards/player?name=`; 15 min, keyed by the lowercased name. A 404 returns `{error:"Player not found. Check the name or make the profile public on Idleon Toolbox."}`.
  - `/api/lb/board?metric=&around=&public=1`: 400 without a metric; upstream `limit=100`; 30 min, keyed by the full query.
  - `/api/lb/names?q=`: `q.trim().length < 2` returns `{players:[]}` without fetching; 10 min.
  - A 429 from any route returns `{error:"Too many lookups today. Try again tomorrow."}`.
  - All four share `budget {name:"lb",cap:500}`.

- [ ] **Step 1:** Write the failing tests:
  - for each route, the upstream URL is right (assert the `fetch` call's URL) and the headers are SITE_HEADERS;
  - `player 404 message`;
  - `names short query does not fetch`;
  - `board needs metric (400)`;
  - `shared lb budget`: after `__resetItFetchForTests`, 500 distinct `names` queries pass and the 501st gives 429.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the 4 routes and `types.ts`. Base: `https://profiles.idleontoolbox.workers.dev/api`.
- [ ] **Step 4:** Run `npx vitest run __tests__/api` and tsc. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): lb routes over Idleon Toolbox's new leaderboards API`.

### Task 3: Metric math and formatting

**Files:**
- Create: `web/lib/leaderboards/metrics.ts`, `web/lib/leaderboards/format.ts`
- Test: `web/__tests__/lib/leaderboards/metrics.test.ts`

**Interfaces:**
- Consumes: `types.ts`; `formatIdleon` from `lib/format.ts`.
- Produces:
  ```ts
  export type Climb = { kind: "top" } | { kind: "tied-top"; ties: number } | { kind: "gap"; delta: number; pct: number; toRank: number };
  export function climbOne(e: RankEntry, lowerIsBetter: boolean): Climb;
  export function gapToCutoff(value: number, rank: number, cutoff: number | undefined, cutoffRank: 10 | 100, lowerIsBetter: boolean): { kind: "inside" } | { kind: "unknown" } | { kind: "gap"; delta: number; pct: number };
  export function formatMetric(v: number, n: Notation): string;
  export function formatDelta(delta: number, n: Notation): string;
  ```
  - `delta` is always the amount to change in the improving direction: positive means "add" for higher-is-better and "subtract" for lower-is-better.
  - `pct = |delta| / max(|value|, tiny)`.
  - `climbOne`:
    - `r===1 && t>1` gives `tied-top`;
    - `r===1` gives `top`;
    - otherwise `delta = lowerIsBetter ? v - nv : nv - v`, and `toRank = nr`.
  - `gapToCutoff` returns `inside` when `rank <= cutoffRank` and `unknown` when there is no cutoff.
  - `formatMetric`:
    - `multiplier` gives `` `${v.toFixed(2)}x` `` (4 decimals when v < 10, matching IT's "4.6622x");
    - `seconds` gives `` `${v.toFixed(v < 5 ? 3 : 1)}s` ``;
    - `bits` and `default` give `formatIdleon(v)`.
  - `formatDelta` returns the sign plus `formatMetric(|delta|)` (`+35`, `−0.4s`).

- [ ] **Step 1:** Write the failing tests, including the Review Focus cases:
  - `climbOne({r:50,v:22424,p:1.8,t:1,nr:49,nv:22459}, false)` gives `{kind:"gap",delta:35,toRank:49}`;
  - lower-is-better: `{r:5,v:12.4,nr:4,nv:12.0}` gives delta `0.4` (and `formatDelta` shows `−0.400s`);
  - `{r:1,t:58}` gives `tied-top 58`, and `{r:1,t:1}` gives `top`;
  - `gapToCutoff(9880-410, 140, 9880, 100, false)` gives gap 410;
  - rank 80 gives `inside`;
  - cutoff `undefined` gives `unknown`;
  - `formatMetric(4.6622,"multiplier")` is `"4.6622x"`;
  - `formatMetric(22424,"default")` is `formatIdleon(22424)`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement both files.
- [ ] **Step 4:** Run it. Expected: PASS. Then tsc.
- [ ] **Step 5:** Commit `feat(lb): rank-gap math and metric formatting`.

### Task 4: Sections, visits, history, head-to-head

**Files:**
- Create: `web/lib/leaderboards/sections.ts`, `web/lib/leaderboards/history.ts`, `web/lib/leaderboards/headToHead.ts`
- Test: `web/__tests__/lib/leaderboards/analysis.test.ts`

**Interfaces:**
- Consumes: `types.ts`.
- Produces:
  ```ts
  // sections.ts
  export type SectionStat = { tab: string; section: string; medianTopPct: number; boards: number };
  export function sectionStrength(ranks: Record<string, RankEntry>, meta: LbMeta): SectionStat[];   // meta order; sections with no ranked board omitted
  // history.ts (localStorage, every access in try/catch)
  export type Baseline = { createdAt: number; ranks: Record<string, number>; globalRank: number };
  export function sinceLastVisit(player: string, current: LbPlayer): { baseline: Baseline | null; moves: Record<string, number>; globalMove: number };
  export type HistoryPoint = { createdAt: number; globalRank: number; top10: number; top100: number };
  export function appendHistory(player: string, current: LbPlayer): HistoryPoint[];
  export function loadHistory(player: string): HistoryPoint[];
  // headToHead.ts
  export type H2HRow = { metric: string; a: RankEntry; b: RankEntry; winner: "a" | "b" | "tie" };
  export function headToHead(a: LbPlayer, b: LbPlayer): { wins: number; losses: number; ties: number; rows: H2HRow[] };
  ```
  - **Keys:**
    - `idleon-leaderboards.v4.baseline.<player-lower>`;
    - `idleon-leaderboards.v4.history.<player-lower>`;
    - `idleon-leaderboards.v4.recentH2H` (used by Task 9).
  - **`sinceLastVisit`:**
    - `moves[m] = baseline.ranks[m] - current.r`, positive meaning climbed;
    - it stores the current data as the new baseline only when `current.createdAt > stored.createdAt`;
    - it returns the moves against the baseline that existed before the call;
    - so with the same `createdAt` it returns the same moves and writes nothing.
  - **`appendHistory`:**
    - it appends only when the `createdAt` is newer than the last point;
    - it keeps the last 365 points;
    - `top10`/`top100` count the ranks `<= 10` and `<= 100`.
  - **`headToHead`:**
    - only metrics present in both players count;
    - the lower `r` wins;
    - an equal `r` is a tie.

- [ ] **Step 1:** Write the failing tests:
  - median top % per section with fixture meta (2 tabs, 3 sections);
  - first visit gives `baseline null` and stores it;
  - the second call with the same `createdAt` gives the same moves and an unchanged store;
  - a newer `createdAt` gives the moves against the old baseline and replaces it;
  - history dedup and the 365 cap;
  - H2H counts with a tie and a metric missing on one side.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the three files.
- [ ] **Step 4:** Run it. Expected: PASS. Then tsc.
- [ ] **Step 5:** Commit `feat(lb): section strength, since-last-visit, history and head-to-head`.

### Task 5: Daily snapshot cron

**Files:**
- Create: `web/scripts/update-lb-snapshot.ts`, `.github/workflows/refresh-lb-snapshot.yml`, `web/lib/leaderboards/snapshot.ts` (generated; seeded by one real local run)
- Test: `web/__tests__/scripts/updateLbSnapshot.test.ts`

**Interfaces:**
- Consumes: `SCRAPER_HEADERS` (Task 1) and `types.ts`.
- Produces `snapshot.ts`:
  ```ts
  export type BoardCutoffs = { top10?: number; top100?: number; lowerIsBetter: boolean; firstSeen: string /* YYYY-MM-DD */ };
  export const LB_SNAPSHOT: { generatedAt: string; meta: LbMeta; boards: Record<string, BoardCutoffs> };
  ```
  `boardCount(): number`, the number of metrics in `meta`, is exported from `web/lib/leaderboards/meta.ts`.
- The script exports these for tests, and its `main` runs only under a `require.main` guard:
  - `buildSnapshot(fetchJson: (url) => Promise<unknown>, previous: typeof LB_SNAPSHOT | null, today: string)`;
  - `renderSnapshot(s): string`.
- **Rules for `buildSnapshot`:**
  - `top10` is `top[9]?.value` and `top100` is `top[99]?.value`;
  - `lowerIsBetter` is `top[0].value < top[top.length-1].value`;
  - `firstSeen` comes from `previous`, or is `today` for a new metric;
  - the requests are spaced 500 ms apart;
  - it throws when fewer than 200 boards come back, so nothing gets written.

- [ ] **Step 1:** Write the failing tests with a fake `fetchJson`, a 3-tab meta and 220 synthetic metrics:
  - the cutoffs are right;
  - `lowerIsBetter` is true for an ascending board;
  - `firstSeen` is kept from `previous` and set to `today` for a new metric;
  - 150 boards OK and 70 failing (rejects) make it throw;
  - the delay is injectable (default 500 ms), so tests pass `0`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the script.
  - CLI: `npx tsx scripts/update-lb-snapshot.ts`. It writes `lib/leaderboards/snapshot.ts` and prints `✓ N boards`.
  - Add `lib/leaderboards/meta.ts`, which exports `boardCount()` and `liveOrSnapshotMeta(live: LbMeta | null): LbMeta`.
- [ ] **Step 4:** Write the workflow:
  - schedule `"30 5 * * *"` plus `workflow_dispatch`, Node 24, `npm ci`;
  - the step runs `timeout -s KILL 14m npx tsx scripts/update-lb-snapshot.ts` with `timeout-minutes: 15`;
  - the commit step adds only `web/lib/leaderboards/snapshot.ts` (same bot identity and "unchanged" guard as `refresh-top-max.yml`);
  - the header comment states the 221 requests a day and the agreement.
- [ ] **Step 5:** Seed it with one real run, `cd web && npx tsx scripts/update-lb-snapshot.ts` (221 requests, ~2 min). Expected: `✓ 220 boards`.
- [ ] **Step 6:** Run the tests and tsc. Expected: PASS.
- [ ] **Step 7:** Commit `feat(lb): daily snapshot of every board's #10/#100 cutoffs`.

### Task 6: New page shell: header, cards, tabs, board table

**Files:**
- Create: `web/components/leaderboards/LbPage.tsx`, `web/components/leaderboards/BoardTable.tsx`, `web/components/leaderboards/useLbData.ts`
- Modify: `web/app/leaderboards/page.tsx` (render `LbPage`; metadata count from `boardCount()`), `web/lib/lbSnapshot.ts` (`saveSnapshot`/`computeDelta` take `Record<string,{rank:number;value:number}>` built from `LbPlayer.ranks`; the storage key and the stored shape are unchanged so existing snapshots keep working)
- Test: `web/__tests__/components/leaderboards/BoardTable.test.tsx`, `web/__tests__/components/leaderboards/LbPage.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  - `useLbData()` returns `{ meta, player, error, loading, load(name), hideAnon, setHideAnon, moves, globalMove, history }`.
    - `meta` comes from `/api/lb/meta`, falling back to `LB_SNAPSHOT.meta`.
    - It persists the player (`idleon-leaderboards.player`) and `hideAnon` (`idleon-leaderboards.hideAnon`), the existing keys.
    - On load it calls `sinceLastVisit` and `appendHistory`.
    - On an error it sets `player` to null.
  - `BoardTable` props: `{ tab: MetaTab; player: LbPlayer | null; moves: Record<string,number>; sort: "it" | "closest" | "worst"; onExpand(metric) }`.
- **UI**, mockup 1, Tailwind matching the current page (`bg-zinc-950/900`, emerald accents):
  - the header holds the player input (a plain input here; autocomplete comes in Task 9), "Jump to a board (N)" (a datalist over the meta labels; choosing one switches to its tab and scrolls to `#board-<key>`), the anon toggle, and "N players · updated HH:MM";
  - the 4 cards: global rank with a caret, net moves, top-10 count and top-100 count;
  - the tabs: Overview | Dashboard | the meta tabs with counts. In this task Overview and Dashboard render placeholders, filled in Tasks 8–10;
  - the sections render as subtitles with jump links;
  - each row shows:
    - board label, plus a "Maxed" badge and a "New" badge (`firstSeen` within 14 days);
    - Rank `#r` with a ▲/▼ move, and `/ players` in its `title`;
    - Value (`formatMetric`) and Top % (`p`);
    - To climb (`climbOne` + `formatDelta`, as `+35 passes #49`, `#1` or `tied #1 (58)`);
    - To top 100 (`gapToCutoff`, `in top 100` or `—` with the `title` "available after the next daily refresh");
  - the sort select offers IT order, closest to next rank (`pct` ascending, `top`/`tied-top` last) and worst top % (`p` descending);
  - `/api/lb/player` errors are shown in the existing red error style.

- [ ] **Step 1:** Write the failing tests:
  - BoardTable renders `+35 passes #49`, `tied #1 (58)`, `in top 100`, `—`, and the Maxed and New badges from fixtures;
  - the `closest` sort order;
  - LbPage loads a player via a mocked `fetch` and shows the 4 cards;
  - a 404 shows the message and clears the rows.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the files. `LeaderboardsPageClient.tsx` is no longer rendered; delete it, along with `components/LeaderboardsTable.tsx` and its test.
- [ ] **Step 4:** Run `npx vitest run __tests__/components/leaderboards __tests__/lib` and tsc. Expected: PASS.
- [ ] **Step 5:** Commit `feat(lb): new leaderboards page on IT's tabs with rank, top %, to climb and to top 100`.

### Task 7: Row expansion: neighbours and top 100

**Files:**
- Create: `web/components/leaderboards/BoardExpand.tsx`
- Modify: `web/components/leaderboards/BoardTable.tsx` (clicking a row toggles `BoardExpand`)
- Test: `web/__tests__/components/leaderboards/BoardExpand.test.tsx`

**Interfaces:**
- Consumes: `/api/lb/board`, `formatMetric`.
- Produces `BoardExpand` with props `{ metric: string; notation: Notation; player: string | null; hideAnon: boolean }`.
  - It fetches `/api/lb/board?metric=&around=<player>` (adding `&public=1` when `hideAnon`).
  - It shows the `around` rows with the player highlighted. With no player it shows the top 10.
  - "Full top 100" reveals all of `top` inline.

- [ ] **Step 1:** Write the failing tests:
  - the around rows render with the player highlighted;
  - "Full top 100" shows 100 rows;
  - the request URL includes `public=1` when `hideAnon`;
  - an error shows "Couldn't reach Idleon Toolbox. Retry".
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement it.
- [ ] **Step 4:** Run it. Expected: PASS. Then tsc.
- [ ] **Step 5:** Commit `feat(lb): expand a board to see your neighbours and the top 100`.

### Task 8: Dashboard, part 1: kept sections plus the new lists

**Files:**
- Create: `web/components/leaderboards/LbDashboard.tsx`
- Modify: `web/components/leaderboards/LbPage.tsx` (the Dashboard tab renders `LbDashboard`)
- Delete: `web/components/Dashboard.tsx` and `web/__tests__/components/Dashboard.test.tsx` once their sections are ported
- Test: `web/__tests__/components/leaderboards/LbDashboard.test.tsx`

**Interfaces:**
- Consumes:
  - `LbPlayer`, `LbMeta` and `LB_SNAPSHOT`;
  - from Task 3: `climbOne`, `gapToCutoff`, `formatMetric` and `formatDelta`;
  - from Task 4: `sectionStrength`;
  - `lib/lbSnapshot.ts`.
- Produces `LbDashboard` with props `{ meta; player; moves; snapshot; onSaveSnapshot; history }`. The sections follow mockup 2, top to bottom:
  1. **"Progress since <date>"**: the manual snapshot with net movement and the boards climbed and dropped. Same behavior as now, including its Save button.
  2. **"Tier summary"**: the bands are Top 10, 11–50, 51–100, 101–500 and 500+.
  3. **"Strength by section"**: clicking a section sets a `sectionFilter` that the next lists use.
  4. **"Worst positions"**:
     - the 40 boards with the highest `p`, honoring `sectionFilter`;
     - columns: Board, Section, Rank `#r / players`, Top % and To top 100.
  5. **"Cheapest climbs"**: the 15 smallest-`pct` `climbOne` gaps.
  6. **"Points to reach the top 100"**:
     - a Top 100 / Top 10 toggle;
     - it lists only `gap` results, sorted by `pct` ascending;
     - columns: Board, Need, and "#100 has" (or "#10 has").
  7. **"Maxed boards you're missing"**: `metric.maxed && !(r===1)`, showing your value, the cap (`metric.top`) and `topTies`.
  8. **"Your best positions"**: the 30 lowest `r`, with the top %.

- [ ] **Step 1:** Write the failing tests with fixtures:
  - the worst list is sorted by `p` and the section filter narrows it;
  - the cheapest-climbs order;
  - the top-100/top-10 toggle switches the cutoff and the column header;
  - maxed-missing excludes the boards where you're at #1;
  - the progress card renders when a snapshot exists.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement it, reusing the current Dashboard's band thresholds and hero-card styling.
- [ ] **Step 4:** Run it. Expected: PASS. Then tsc.
- [ ] **Step 5:** Commit `feat(lb): dashboard with section strength, worst positions, climbs, top-100 gaps and maxed boards`.

### Task 9: Rivals, head-to-head, player picker with autocomplete

**Files:**
- Create: `web/components/leaderboards/PlayerPicker.tsx`, `web/components/leaderboards/HeadToHead.tsx`, `web/components/leaderboards/Rivals.tsx`
- Modify: `LbDashboard.tsx` (add Rivals and HeadToHead); `LbPage.tsx` (the header player input becomes `PlayerPicker`)
- Test: `web/__tests__/components/leaderboards/headToHead.test.tsx`

**Interfaces:**
- Consumes: `/api/lb/names`, `/api/lb/board?metric=globalRanking&around=`, `/api/lb/player`, and `headToHead` (Task 4).
- Produces:
  - `PlayerPicker` with props `{ value; onPick(name); chips?: {label:string; name:string}[] }`. It is a text input with a 300 ms debounced `/api/lb/names` lookup (2+ characters) and a suggestion list that takes the keyboard (↑/↓/Enter). Chips call `onPick`.
  - `Rivals` with props `{ player: string; onCompare(name) }`:
    - it fetches `globalRanking around`;
    - rows show rank, name and the points difference against you;
    - clicking a row calls `onCompare`;
    - there is no per-rival "beats you" count until compared.
  - `HeadToHead` with props `{ me: LbPlayer; meta; initial?: string }`:
    - `PlayerPicker` chips come from the rivals, the global top 10 (`globalRanking` top) and recently compared (at most 8, newest first, in `idleon-leaderboards.v4.recentH2H`);
    - once a player is picked it fetches their `/api/lb/player`;
    - it shows "W wins · L losses · T ties" and a table (Board, You `#r`, Them `#r`), filterable by section.

- [ ] **Step 1:** Write the failing tests:
  - typing "dra" calls `/api/lb/names?q=dra` once after the debounce (use fake timers);
  - choosing a suggestion fetches `/api/lb/player?name=Dragami` and renders the W/L/T line;
  - the recent list keeps 8 and dedupes;
  - a rival click opens the comparison.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement it.
- [ ] **Step 4:** Run it. Expected: PASS. Then tsc.
- [ ] **Step 5:** Commit `feat(lb): global rivals and head-to-head with name autocomplete`.

### Task 10: Overview tab and history chart

**Files:**
- Create: `web/components/leaderboards/LbOverview.tsx`, `web/components/leaderboards/HistoryChart.tsx`
- Modify: `LbPage.tsx` (the Overview tab) and `LbDashboard.tsx` (the history section at the bottom)
- Test: `web/__tests__/components/leaderboards/overviewHistory.test.tsx`

**Interfaces:**
- `LbOverview` with props `{ meta; onOpenTab(key) }`: the `globalRanking` top 10 (from `/api/lb/board?metric=globalRanking`) and one card per meta tab ("N boards ›").
- `HistoryChart` with props `{ points: HistoryPoint[] }` is an inline SVG with two polylines: the global rank (inverted, so up means better) and the top-10 count. It shows "Load this player again after the next refresh to start the history" when there are fewer than 2 points. No chart library.

- [ ] **Step 1:** Write the failing tests:
  - Overview renders 10 names and 5 tab cards, and a card click calls `onOpenTab`;
  - HistoryChart shows the empty message with 1 point and two `polyline`s with 3 points.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement it.
- [ ] **Step 4:** Run it. Expected: PASS. Then tsc.
- [ ] **Step 5:** Commit `feat(lb): overview tab and rank history chart`.

### Task 11: Home count, README, cleanup, owner notice, preview check

**Files:**
- Modify: `web/app/page.tsx` (`BOARD_COUNT` from `boardCount()`), `README.md` (board count and the leaderboards description)
- Create: `it-leaderboards-v4-notice.md` at the repo root. It is untracked and not committed, a text for the user to send.
- Test: the full `npx vitest run` and tsc

- [ ] **Step 1:** Point the home and leaderboards metadata at `boardCount()`. `lib/registry.ts` stays (the collectors use it); confirm nothing under `app/` or `components/` imports it with `grep -rn "lib/registry" app components`, which must show no matches.
- [ ] **Step 2:** Update the README counts and wording.
- [ ] **Step 3:** Write `it-leaderboards-v4-notice.md` for the IT owner, in English, short and in the tone of the earlier messages:
  - the endpoints we'll call (`meta`, `player`, `board`, `names`);
  - the caches (30/15/30/10 min);
  - the shared cap of 500 a day with the count logged;
  - the daily cron's 221 requests with the scraper UA;
  - the exact Origin.
  Ask if that's OK before we ship.
- [ ] **Step 4:** Run `npx vitest run` and `npx tsc --noEmit -p .`. Expected: all pass, with the known skips.
- [ ] **Step 5:** Commit `chore(lb): board counts from the snapshot, README`. Push and open a PR. The body lists the Review Focus items and says the deploy waits for the owner's reply and for the Vercel pause to be lifted.
- [ ] **Step 6:** On the Vercel preview, once the site is unpaused, load ARKHE and compare 3 boards (rank, top % and the next value) with idleontoolbox.com/leaderboards. Then report to the user.
