# Codebase Structure

**Analysis Date:** 2026-06-01

## Directory Layout

```text
idleon-leaderboards-tracker/
├── .github/workflows/        # CI/CD (GitHub Actions)
├── .planning/                # Generated documents (this directory)
├── web/                      # Next.js web application (primary)
│   ├── app/                  # App Router pages and API routes
│   │   ├── api/              # Server-side API route handlers
│   │   ├── drop-rate/        # Drop Rate tracker page
│   │   ├── leaderboards/     # Leaderboards tracker page
│   │   ├── sheets/           # Sheets & Tools hub page
│   │   ├── talents-level/    # Talents tracker page
│   │   ├── tome/             # Tome Score tracker page
│   │   ├── globals.css       # Global styles + Tailwind directives
│   │   ├── icon.svg          # App favicon/icon
│   │   ├── layout.tsx        # Root layout (font, nav, analytics)
│   │   └── page.tsx          # Home page (shortcut cards)
│   ├── components/           # React components
│   │   ├── dropRate/         # Drop Rate-specific UI
│   │   ├── talentsLevel/     # Talents-specific UI
│   │   ├── tome/             # Tome-specific UI
│   │   ├── AnonExcludedNote.tsx
│   │   ├── Dashboard.tsx
│   │   ├── LeaderboardsTable.tsx
│   │   ├── ProfileNameLoader.tsx
│   │   └── TopNav.tsx
│   ├── data/                 # Static data files
│   ├── lib/                  # Shared utilities and domain logic
│   │   ├── arkh/           # Arkh-related utilities
│   │   ├── dropRate/         # Drop Rate domain logic
│   │   ├── it/               # IdleonToolbox parsers, services, stubs, utility
│   │   │   ├── _stubs/       # Component/hook stubs
│   │   │   ├── data/         # IT game data JSON
│   │   │   ├── parsers/      # Data parsing modules
│   │   │   ├── services/     # API service wrappers
│   │   │   └── utility/      # Helper scripts and utilities
│   │   ├── talentsLevel/     # Talents domain logic
│   │   ├── tome/             # Tome domain logic
│   │   ├── format.ts         # Number/time formatting
│   │   ├── lbSnapshot.ts     # Leaderboards snapshot/localStorage
│   │   ├── rank.ts           # Rank tier calculation and colors
│   │   ├── registry.ts       # 153-board leaderboard registry
│   │   └── sheets.ts         # Sheets & Tools data
│   ├── public/               # Static assets served directly
│   ├── scripts/              # Build and utility scripts
│   ├── next.config.mjs       # Next.js config (Turbopack, strict mode)
│   ├── next-env.d.ts         # Next.js ambient types
│   ├── package.json          # Dependencies and scripts
│   ├── package-lock.json     # npm lockfile
│   ├── postcss.config.mjs    # PostCSS config (Tailwind + autoprefixer)
│   ├── README.md             # Web README
│   ├── tailwind.config.ts    # Tailwind theme customizations
│   └── tsconfig.json         # TypeScript strict config with path aliases
├── Code.gs                   # Google Apps Script (leaderboards spreadsheet)
├── Code_Tome.gs              # Apps Script (Tome tracker spreadsheet)
├── Code_TomeRaw.gs           # Apps Script (raw Tome data)
├── Code_TomeRaw_v6_1.gs      # Apps Script (Tome v6.1 compat)
├── Idleon_Leaderboards.xlsx  # Spreadsheet template (leaderboards)
├── Idleon_Tome_Tracker.xlsx  # Spreadsheet template (Tome)
├── INSTRUCTIONS.md           # Spreadsheet setup instructions
├── INSTRUCTIONS_TOME.md      # Tome spreadsheet instructions
├── README.md                 # Root project README
├── TOME_PARITY.md            # Tome parity documentation
└── .gitignore                # Git ignore rules
```

## Directory Purposes

**`web/app/api/`**

- Purpose: Server-side Next.js API route handlers
- Contains: `leaderboards/route.ts`, `profile/route.ts`
- Key files: `leaderboards/route.ts` — caching proxy to IdleonToolbox
- No subdirectories beyond route folders

**`web/app/<feature>/`**

- Purpose: One directory per major feature/page
- Contains: `page.tsx` (Server Component), sometimes `*Client.tsx` (Client Component)
- Key features: leaderboards, tome, drop-rate, talents-level, sheets
- Pattern: Server page → imports Client component when interactivity is needed

**`web/components/`**

- Purpose: Reusable React components and feature-specific component trees
- Contains: Top-level shared components + per-feature subdirectories
- Key files: `TopNav.tsx`, `Dashboard.tsx`, `LeaderboardsTable.tsx`
- Subdirectories: `dropRate/`, `talentsLevel/`, `tome/`

**`web/lib/`**

- Purpose: Pure utility and domain logic (no React components)
- Contains: `format.ts`, `rank.ts`, `lbSnapshot.ts`, `registry.ts`, plus per-feature directories
- Key files: `registry.ts` (153-board mapping), `lbSnapshot.ts` (localStorage snapshot logic)
- `lib/it/` — IdleonToolbox integration: parsers, services, game data, utility scripts

**`web/scripts/`**

- Purpose: Build/auxiliary scripts
- Contains: Node.js scripts run via tsx

**Root-level `.gs` and `.xlsx` files**

- Purpose: Legacy Google Sheets version of the tracker
- Contains: Apps Script source and Excel templates
- These are the "v1" spreadsheet version; the `web/` folder is the recommended v2

## Key File Locations

**Entry Points:**

- `web/app/layout.tsx` — Root layout (applies to all pages)
- `web/app/page.tsx` — Home page with feature shortcut cards
- `web/app/api/leaderboards/route.ts` — API route entry for leaderboard data

**Configuration:**

- `web/next.config.mjs` — Next.js runtime config
- `web/tsconfig.json` — TypeScript compiler options and path aliases
- `web/tailwind.config.ts` — Tailwind theme extensions (colors, font)
- `web/postcss.config.mjs` — CSS processing pipeline

**Core Logic:**

- `web/lib/registry.ts` — Leaderboard category and board definitions
- `web/lib/lbSnapshot.ts` — Snapshot save/load and delta computation
- `web/lib/rank.ts` — Rank tier colors and classification
- `web/lib/format.ts` — Idleon-style number formatting

**Documentation:**

- `README.md` — Project overview, deploy button, local setup
- `INSTRUCTIONS.md` — Spreadsheet version setup guide
- `TOME_PARITY.md` — Tome scoring documentation

## Naming Conventions

**Files:**

- `kebab-case` for directories: `drop-rate/`, `talents-level/`
- `PascalCase.tsx` for React components: `Dashboard.tsx`, `TopNav.tsx`
- `camelCase.ts` for utilities: `lbSnapshot.ts`, `format.ts`
- `*.test.ts` / `*.spec.ts` — not present in current codebase

**Special Patterns:**

- `*PageClient.tsx` — Client Component used by a Server page (e.g., `LeaderboardsPageClient.tsx`)
- `route.ts` — Next.js App Router API route handler
- `page.tsx` — Next.js App Router page component

## Where to Add New Code

**New Page:**

- Server page: `web/app/<kebab-feature>/page.tsx`
- Client component (if interactive): `web/app/<kebab-feature>/<Feature>PageClient.tsx`
- Add nav link: `web/components/TopNav.tsx`

**New Component:**

- Shared component: `web/components/<ComponentName>.tsx`
- Feature-specific: `web/components/<feature>/<ComponentName>.tsx`

**New Utility:**

- Shared: `web/lib/<utility>.ts`
- Feature-specific: `web/lib/<feature>/<utility>.ts`

**New API Route:**

- Handler: `web/app/api/<route-name>/route.ts`

## Special Directories

**`web/lib/it/`**

- Purpose: IdleonToolbox integration — parsers, services, game data, utilities, and stub components/hooks
- Source: Reverse-engineered or adapted from IdleonToolbox source
- Committed: Yes (part of repo)

**`web/public/`**

- Purpose: Static assets (images, fonts, JSON) served at root path
- Committed: Yes

---

_Structure analysis: 2026-06-01_
_Update when directory structure changes_
