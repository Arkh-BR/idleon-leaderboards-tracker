# Testing

**Analysis Date:** 2026-06-01 (Updated: 2026-06-01)

## Test Structure

### Unit + Component Tests (Vitest)

Framework: **Vitest v2.1.9** + **happy-dom** + **@testing-library/react**

| Test file | # tests | Target |
|---|---|---|
| `__tests__/lib/format.test.ts` | 16 | `lib/format.ts` (~95%) |
| `__tests__/lib/rank.test.ts` | 20 | `lib/rank.ts` (100%) |
| `__tests__/lib/lbSnapshot.test.ts` | 18 | `lib/lbSnapshot.ts` (100%) |
| `__tests__/lib/registry.test.ts` | 11 | `lib/registry.ts` (~94%) |
| `__tests__/lib/sheets.test.ts` | 5 | `lib/sheets.ts` |
| `__tests__/lib/corgan/formulas.test.ts` | 23 | `lib/corgan/formulas.ts` (~95%) |
| `__tests__/components/TopNav.test.tsx` | 3 | `components/TopNav.tsx` (~99%) |
| `__tests__/components/LeaderboardsTable.test.tsx` | 6 | `components/LeaderboardsTable.tsx` (~76%) |
| `__tests__/components/Dashboard.test.tsx` | 7 | `components/Dashboard.tsx` (~92%) |
| `__tests__/app/api/leaderboards/route.test.ts` | 7 | `app/api/leaderboards/route.ts` |

**Total: 116 tests — all passing ✅**

### E2E Tests (Playwright)

Framework: **Playwright v1.60.0** with Chromium

| Test file | # tests | Flows covered |
|---|---|---|
| `e2e/homepage.spec.ts` | 2 | Homepage, navigation to leaderboards |
| `e2e/leaderboards.spec.ts` | 4 | Form, tabs, empty state, localStorage persistence |

**Total E2E: 6 tests — all passing ✅**

## Scripts

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "e2e": "playwright test"
}
```

## Infrastructure

- `vitest.config.ts` — aliases, coverage v8, happy-dom, `include` for `__tests__/**/*.test.ts`
- `__tests__/setupTests.ts` — global `localStorage` mock
- `playwright.config.ts` — dev server on localhost:3000, Chromium desktop
- `.github/workflows/ci.yml` — lint + test + coverage + build + E2E

## Coverage Highlights

```
lib/format.ts                ~95%  (lines 22-23: formatRelativeTime edge cases)
lib/rank.ts                  100%
lib/lbSnapshot.ts            100%
lib/registry.ts              ~94%
lib/corgan/formulas.ts       ~95%
components/TopNav.tsx          ~99%
components/Dashboard.tsx       ~92%
components/LeaderboardsTable.tsx  ~76%
```

## Next Steps

- Expand coverage to `lib/corgan/game-helpers.ts`, `lib/corgan/computeDR.ts`
- Expand coverage to `lib/it/parsers/`
- Add E2E tests for actual leaderboard loading with mocked API
- Consider visual regression tests with Playwright screenshots

---
_Updated: 2026-06-01_
