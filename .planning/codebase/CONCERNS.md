# Concerns

**Analysis Date:** 2026-06-01

## Technical Debt

**~~No formal test suite~~ — RESOLVIDO**

- 88 unit/component tests (Vitest + happy-dom + Testing Library)
- 6 E2E tests (Playwright + Chromium)
- CI workflow runs lint + test + build on every push/PR
- Details: see `.planning/codebase/TESTING.md`

**Hardcoded API base URL and headers**

- **Risk:** If IdleonToolbox changes endpoint or blocks spoofed headers, app breaks
- **Location:** `web/app/api/leaderboards/route.ts` — `API_BASE`, `Referer`, `User-Agent`
- **Impact:** High — external dependency with no SLA or contract
- **Recommendation:** Monitor IT API health; add graceful degradation UI when API unreachable

## Known Issues

**In-memory cache is ephemeral**

- Server cache resets on every cold start (Vercel serverless deploy or idle timeout)
- Users may see duplicated API calls after deploy
- No distributed cache (Redis) for multi-instance deployments

**No error boundary in client components**

- A runtime React error in `LeaderboardsTable.tsx` or `Dashboard.tsx` could crash the entire page
- Next.js default error boundary is minimal

## Security

**Client-exposed API route**

- API route is public (no auth) by design, but could be hammered by bots
- No rate limiting on the API route itself (only client-side cache TTL)
- Consider adding basic rate limiting or Cloudflare protection

**localStorage keys use predictable names**

- `idleon-leaderboards.lb.ptsSnapshot.<player-lower>` — collision risk if multiple users share browser
- Not a security risk per se, but a data isolation concern

## Performance

**Client-side sorting on large datasets**

- `LeaderboardsTable.tsx` sorts 153 boards in-memory with `useMemo`
- Currently negligible at 153 items, but will not scale if board count increases significantly

**API parallelization strategy**

- Currently fetches 7 categories in parallel via `Promise.all`
- If IT API rate-limits per IP, sequential fetching with backoff may be safer

## Documentation Gaps

**Missing `CONTRIBUTING.md` or development guide**

- New contributors must infer setup from `README.md` web section only
- `web/README.md` is minimal (local dev instructions only)

**Component prop interfaces not documented**

- Props types exist (TypeScript) but no JSDoc explaining expected shapes or behaviors

## Dependency Concerns

**React 19 (very new)**

- React 19 recently released; ecosystem libraries may lag in compatibility
- `next` 16 is bleeding-edge; monitor for patch releases
- `--legacy-peer-deps` was needed for `@testing-library/react` compatibility
- Consider pinning to LTS versions if stability is prioritized over new features

---
_Concerns analysis: 2026-06-01_
_Update during retrospectives or when issues arise_
