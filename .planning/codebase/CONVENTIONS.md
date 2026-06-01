# Coding Conventions

**Analysis Date:** 2026-06-01

## Naming Patterns

**Files:**

- `PascalCase.tsx` for React components and pages
- `kebab-case` for directories (`drop-rate/`, `talents-level/`)
- `camelCase.ts` for utility modules
- `*PageClient.tsx` suffix for Client Components consumed by a Server page

**Functions:**

- `camelCase` for all functions
- No special async prefix (standard `async function` when needed)
- Event handlers: camelCase descriptive names (e.g., `toggleSort`, `toggleExpand`)

**Variables:**

- `camelCase` for variables
- `UPPER_SNAKE_CASE` for constants (e.g., `CACHE_TTL_MS`, `CATEGORY_OPTIONS`)
- No underscore prefix for private members

**Types:**

- `PascalCase` for interfaces, type aliases, and enums
- No `I` prefix on interfaces (e.g., `BoardResult`, `CategorySpec`)
- Explicit `Props` type for component props objects

## Code Style

**Formatting:**

- No Prettier config detected — likely uses editor defaults
- 2-space indentation
- Single quotes for strings
- Semicolons used
- Arrow functions preferred for callbacks

**Linting:**

- `next lint` configured in `package.json`
- No custom ESLint config file present — uses Next.js built-in rules

## Import Organization

**Order:**

1. React / Next.js built-ins (`react`, `next/*`)
2. External packages (`date-fns`, `lodash.merge`)
3. Internal path aliases (`@/components/*`, `@/lib/*`, `@/app/api/*`)
4. Relative imports (`./page-client`)
5. Type-only imports (`import type { ... }`)

**Path Aliases:**

- `@/*` → `web/*` — project root relative
- `@parsers/*` → `./lib/it/parsers/*`
- `@utility/*` → `./lib/it/utility/*`
- `@website-data` → `./lib/it/data/website-data.json`
- `@components/*` → `./lib/it/_stubs/components/*`
- `@hooks/*` → `./lib/it/_stubs/hooks/*`

## Error Handling

**Patterns:**

- API route (`app/api/leaderboards/route.ts`): errors caught per category, aggregated into `errors[]` array without failing the whole request
- Missing/null values handled gracefully (return `"—"` in formatters, `null` for absent ranks)
- `try/catch` around `localStorage` access to prevent crashes in restricted environments

**Error Types:**

- Network/API errors: collected and returned alongside partial data
- Validation: early return with JSON error response (e.g., missing `?player=`)
- Client: no global error boundary observed

## State & Client-Side Patterns

**Hooks:**

- `useState`, `useMemo`, `useCallback`, `useRef`, `useEffect` used idiomatically
- No custom hooks outside of component files (inline usage)

**Data Fetching:**

- Client-side `fetch()` from Client Components
- No React Query / SWR / TanStack Query observed
- Manual loading and error states managed within components

**Persistence:**

- `localStorage` for snapshots (per-player key: `idleon-leaderboards.lb.ptsSnapshot.<player-lower>`)
- `JSON.parse` / `JSON.stringify` with `try/catch` guards

## Comments

**When to Comment:**

- Comments explain "why" (business logic, design decisions) rather than "what"
- Inline comments for complex sorting logic, delta semantics, and caching behavior
- JSDoc/TSDoc: minimal usage; no formal `@param` / `@returns` blocks observed

**TODO Comments:**

- No `TODO` or `FIXME` comments detected in current codebase

## Function Design

**Size:**

- Functions kept concise; inline helpers for small repetitive logic
- Component files can be large (e.g., `LeaderboardsTable.tsx` ~300 lines) but well-organized

**Parameters:**

- Prefer destructured object parameters for component props
- Type-safe props with explicit `Props` or inline type annotations

**Return Values:**

- Explicit return types on exported functions
- Guard clauses for early returns (null checks, validation)

## Module Design

**Exports:**

- Named exports for utilities and types
- Default exports for page and layout components
- Barrels not used; explicit imports preferred

**Type Safety:**

- Strict TypeScript (`strict: true`)
- `isolatedModules: true` — each file must be independently transpilable
- No `any` types observed in core files

**React Conventions:**

- `"use client"` directive at top of Client Components
- Server Components used by default (no directive)
- Composition pattern: Server page → imports Client component when interactivity needed

---

_Convention analysis: 2026-06-01_
_Update when patterns change_
