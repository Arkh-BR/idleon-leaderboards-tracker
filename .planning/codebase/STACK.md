# Technology Stack

**Analysis Date:** 2026-06-01

## Languages

**Primary:**

- TypeScript 5.7 - All Next.js app code, components, and utilities

**Secondary:**

- JavaScript (Node.js) - Build scripts, Next.js config
- Google Apps Script (JavaScript dialect) - Spreadsheet automation version (`Code.gs`, `Code_Tome*.gs`)

## Runtime

**Environment:**

- Node.js 18+ (implied by Next.js 16 requirements)
- Browser runtime for client-side components and localStorage usage

**Package Manager:**

- npm (inferred from `package-lock.json` present)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**

- Next.js 16.2.6 - Full-stack React framework (App Router, static export ready)
- React 19.0.0 - UI library
- React DOM 19.0.0 - DOM rendering

**Styling:**

- Tailwind CSS 3.4.15 - Utility-first CSS framework
- PostCSS 8.4.49 - CSS processing pipeline

**Build/Dev:**

- TypeScript 5.7.2 - Type checking and transpilation
- tsx 4.22.3 - TypeScript execution for scripts
- autoprefixer 10.4.20 - CSS vendor prefixing

## Key Dependencies

**Critical:**

- `@vercel/analytics` 2.0.1 - Web analytics tracking (production only)
- `date-fns` 2.30.0 - Date formatting and manipulation
- `lodash.merge` 4.6.2 - Deep object merging for data processing
- `next` 16.2.6 - Core framework for routing, API routes, SSR, and static generation

**Infrastructure:**

- Playwright 1.60.0 - Browser automation (E2E testing capability, currently unused in scripts)

## Configuration

**Environment:**

- No `.env` files present; all configuration is inline or derived
- External API base URL hardcoded: `https://profiles.idleontoolbox.workers.dev/api/leaderboards`
- `CACHE_TTL_MS = 15 * 60 * 1000` (15 minutes) — in-memory cache in API route

**Build:**

- `next.config.mjs` — Next.js config with Turbopack root enabled, React Strict Mode
- `tsconfig.json` — TypeScript with strict mode, path aliases (`@/*`, `@parsers/*`, `@utility/*`, etc.)
- `tailwind.config.ts` — Custom theme colors (`gold`, `silver`, `bronze`, `ink`) and font mapping
- `postcss.config.mjs` — Tailwind + autoprefixer pipeline

## Platform Requirements

**Development:**

- Any platform with Node.js 18+
- `npm install && npm run dev` → `http://localhost:3000`

**Production:**

- Deploy target: Vercel (one-click deploy button configured)
- Edge/Node runtime: Node.js for API routes (`runtime = "nodejs"`)
- Static optimization: Next.js App Router with ISR disabled (`revalidate = 0`)

---

_Stack analysis: 2026-06-01_
_Update after major dependency changes_
