# Idleon Leaderboards Tracker

A full-stack [Next.js](https://nextjs.org) web app that tracks any
[Legends of Idleon](https://www.legendsofidleon.com) player's standing across
all **153 [IdleonToolbox](https://idleontoolbox.com) leaderboards** — plus
game-faithful calculators for Drop Rate, Tome score, and Talents. No login, no
database, free to host.

**One-click deploy on Vercel:**
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Arkh-BR/idleon-leaderboards-tracker&root-directory=web)
(set **Root Directory** to `web`).

---

## Features

| Tool | What it does |
|---|---|
| **Leaderboards Tracker** | Your rank and score across all 153 IT boards, with search, category filters, sortable columns, and an expandable top-10 per board. |
| **Dashboard** | Tier summary, heatmap by category, worst positions, quick wins, and your best 30 — computed from the live data. |
| **Snapshot / Delta** | Save a snapshot per player (browser `localStorage`) and see net rank movement on the next visit. |
| **Drop Rate Tracker** | Game-code-faithful Drop Rate breakdown, ported from the in-game formulas. |
| **Tome Score Tracker** | Local Best-Tome calculator — paste your save JSON, no upload. |
| **Talents Level Tracker** | Per-talent effective levels from your save. |
| **Sheets & Tools hub** | Curated links to community spreadsheets and tools. |

Data comes from the public IdleonToolbox API — no authentication required.
A server-side route proxies and caches it (15-minute TTL) because IT blocks
direct cross-origin calls from the browser.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5.7**
- **Tailwind CSS 3.4** — dark theme with a custom gold/silver/bronze palette
- **Vitest** + **happy-dom** + **Testing Library** for unit/component tests
- **Playwright** for E2E
- No database — state lives in the public API, an in-memory server cache, and
  browser `localStorage`

## Getting started

Requires **Node.js 18+** (tested on Node 24).

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

### Production build

```bash
npm run build
npm start
```

### Available scripts (`web/`)

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server (Turbopack). |
| `npm run build` | Production build. |
| `npm start` | Serve the production build. |
| `npm run lint` | Run ESLint (`next lint`). |
| `npm test` | Run the Vitest unit/component suite. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:coverage` | Vitest with v8 coverage report. |
| `npm run e2e` | Run the Playwright E2E tests. |

## Testing

122 automated tests (116 Vitest unit/component + 6 Playwright E2E), all
passing. `.github/workflows/ci.yml` runs lint → unit tests → coverage → build
→ E2E on every push and pull request.

## Project layout

```text
.
├── .github/workflows/   # CI (ci.yml) + scheduled data-refresh crons
├── .planning/           # Codebase docs (architecture, stack, structure, state)
└── web/                 # Next.js app (the project)
    ├── app/             # App Router pages + API routes
    │   ├── api/         # Server-side proxy/cache routes
    │   ├── leaderboards/ drop-rate/ tome/ talents-level/ sheets/
    │   ├── layout.tsx   # Root layout (font, nav, analytics)
    │   └── page.tsx     # Home (feature shortcut cards)
    ├── components/      # React components (+ per-feature subfolders)
    ├── lib/             # Domain logic (registry, format, rank, snapshots,
    │                    #   drop-rate, tome, talents, IT parsers)
    ├── data/            # Static game data
    └── scripts/         # tsx build/utility scripts
```

See [`.planning/`](.planning/) for in-depth architecture, stack, structure, and
state docs.

## Deploy on Vercel

1. Push the repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Set **Root Directory** to `web` (Framework Preset: Next.js, auto-detected).
4. Deploy. No env vars, no database.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, testing, and PR guidelines.

---

Data source: [idleontoolbox.com](https://idleontoolbox.com) (public API).
IdleonToolbox source: [Morta1/IdleonToolbox](https://github.com/Morta1/IdleonToolbox).
Not affiliated with Lava / Legends of Idleon.
