# State

**Project:** Idleon Leaderboards Tracker
**Repository:** `Arkh-BR/idleon-leaderboards-tracker`
**Last Updated:** 2026-06-01
**Active Branch:** `main`

---

## Current Status

### What's Working

- Full-stack Next.js 16 app deployed on Vercel
- IT Leaderboards Tracker (153 boards via IdleonToolbox API)
- Tome Score Tracker (local calculator with JSON paste)
- Drop Rate Tracker (game-code-faithful breakdown)
- Talents Level Tracker (per-talent effective levels)
- Sheets & Tools hub (curated community links)
- Snapshot/delta system for leaderboard progress tracking
- Server-side caching (15min TTL) for API route
- Dark-themed Tailwind UI with custom gold/bronze/silver palette
- **Test suite:** 122 automated tests (116 Vitest + 6 Playwright E2E) — all passing ✅
  - *Unit/Component:* 116 tests across 10 files (`lib/`, `components/`, `app/api/`)
  - *E2E:* 6 tests across 2 files (`homepage`, `leaderboards`) with Chromium
  - *Coverage:* `lib/rank.ts` 100%, `lib/lbSnapshot.ts` 100%, `lib/format.ts` ~95%, `lib/corgan/formulas.ts` ~95%, `components/Dashboard.tsx` ~92%, `components/TopNav.tsx` ~99%
  - *Infra:* Vitest v2 + happy-dom + Testing Library + Playwright v1.60
  - *CI/CD:* `.github/workflows/ci.yml` runs lint + unit tests + coverage + build + E2E on push/PR
  - *Docs:* `CONTRIBUTING.md` added with setup, testing, and contribution guidelines

### What's In Progress / Next

1. Expandir cobertura para `lib/corgan/` (game-helpers, computeDR), `lib/it/parsers/`, páginas de utilitários
2. Expandir E2E tests com mock da API de leaderboards
3. Adicionar testes visuais (Playwright screenshots) para regressão de UI

---

## Decisions Made

| Decision | Rationale | Date |
|---|---|---|
| **Next.js 16 + React 19** | Latest features, App Router, Server Components | Early 2025 |
| **No database** | All data from public API + browser localStorage; keeps app simple and free-hosted | Early 2025 |
| **Vercel hosting** | Zero-config deploy, built-in Analytics, edge caching | Early 2025 |
| **Turbopack in dev** | Faster HMR during development | 2025 |
| **Vitest over Jest** | Native ESM support, faster, simpler config, integrates well with Next.js + TypeScript | 2026-06-01 |
| **happy-dom over jsdom** | Lighter, faster, sufficient for tested libs | 2026-06-01 |
| **Testing Library** | User-centric queries (`getByRole`), accessibility-first tests | 2026-06-01 |
| **v8 coverage provider** | Built into Vitest, accurate branch/function/line reports | 2026-06-01 |
| **Playwright over Cypress** | Native TypeScript, Next.js dev server integration, headless Chromium | 2026-06-01 |

---

## Known Risks

| Risk | Severity | Mitigation |
|---|---|---|
| IdleonToolbox API changes/blocks | High | Monitor; graceful degradation UI; cache aggressively |
| React 19 ecosystem gaps | Medium | Pin versions; upgrade carefully; `--legacy-peer-deps` when needed |
| Cache resets on deploy | Low | Acceptable for leaderboard data (15min stale OK) |
| Manual deploy validation | Low | CI/CD configurado; valida lint + test + build + E2E em cada push |

---

## Metrics

- **Leaderboards tracked:** 153
- **Test files:** 12 (10 Vitest + 2 Playwright E2E)
- **Total tests:** 122 (todos passando ✅)
  - *Unit/Component:* 116
  - *E2E:* 6
- **API categories:** 7 (Global, General, Tasks, Skills, Character, Misc, Caverns)
- **Snapshot storage:** localStorage (per-player, per-device)
- **Cache TTL:** 15 minutes (server-side)

---

## Next Actions (Priority Order)

1. [x] Install Vitest + coverage + happy-dom
2. [x] Escrever 10 arquivos de teste (116 tests) — `lib/`, `components/`, `app/api/`, `corgan/formulas.ts`
3. [x] Adicionar scripts `test`, `test:watch`, `test:coverage`, `e2e`
4. [x] Criar workflow CI (lint + test + coverage + build + E2E)
5. [x] Configurar Playwright + escrever 6 E2E tests
6. [x] Integrar E2E no CI workflow
7. [x] Escrever `CONTRIBUTING.md`
8. [ ] Expandir cobertura para `lib/corgan/game-helpers.ts`, `lib/corgan/computeDR.ts`
9. [ ] Expandir cobertura para `lib/it/parsers/`
10. [ ] Adicionar testes visuais com Playwright screenshots
11. [ ] Explorar: export snapshot data como CSV/JSON
12. [ ] Explorar: offline/PWA para visualização de leaderboards

---

_Updated: 2026-06-01_
_Keep this file current after every significant change or decision._
