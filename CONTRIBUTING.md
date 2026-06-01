# Contributing to Idleon Leaderboards Tracker

Thanks for your interest in improving the project! This document covers how to set up your local environment, run tests, and submit changes.

---

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Arkh-BR/idleon-leaderboards-tracker.git
   cd idleon-leaderboards-tracker/web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   > **Note:** If you encounter peer-dependency warnings about React 19, you may need:
   > ```bash
   > npm install --legacy-peer-deps
   > ```

3. **Run the dev server**
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

---

## Project Structure

```
web/
  app/                  # Next.js App Router pages
    api/                # API routes
    leaderboards/       # IT Leaderboards Tracker page
    drop-rate/          # Drop Rate Tracker page
    talents-level/      # Talents Level Tracker page
    tome/               # Tome Score Tracker page
    sheets/             # Sheets & Tools hub
  components/           # React shared components
    dropRate/           # Drop Rate specific components
    talentsLevel/       # Talents Level specific components
    tome/               # Tome Score specific components
  lib/                  # Utilities, parsers, game logic
    corgan/             # Corgan engine (save parser + DR calculator)
    dropRate/           # Drop Rate breakdown helpers
    it/                 # IdleonToolbox save parsers
  __tests__/            # Test suite (Vitest + Testing Library)
  e2e/                  # End-to-end tests (Playwright)
```

---

## Testing

We use **Vitest** for unit/component tests and **Playwright** for end-to-end tests.

### Running Tests

```bash
# Unit + component tests (fast)
npm run test           # single run
npm run test:watch     # watch mode
npm run test:coverage  # with coverage report

# E2E tests (slower, starts dev server)
npm run e2e
```

### Writing Tests

- **Unit tests:** Place in `__tests__/**/*.test.ts` or `*.test.tsx`.
- **Component tests:** Use `@testing-library/react` with `happy-dom`.
- **API route tests:** Mock `globalThis.fetch` before importing the route.
- **E2E tests:** Place in `e2e/**/*.spec.ts`.

### Coverage Goals

- **Target:** >90% statements on business logic (`lib/*.ts`, `components/*.tsx`)
- **Current:** `lib/rank.ts` 100%, `lib/lbSnapshot.ts` 100%, `lib/format.ts` ~95%

---

## Code Style

- **TypeScript strict mode is enabled.** No `any` unless absolutely necessary.
- **Tailwind CSS** for styling. No custom CSS files.
- **ESLint** (`next lint`) runs automatically in CI.

---

## Submitting Changes

1. Create a branch: `git checkout -b feature/your-feature-name`
2. Make your changes + add tests
3. Ensure all tests pass: `npm run test && npm run e2e`
4. Push and open a Pull Request

The CI will run lint, unit tests, coverage, build check, and E2E tests before allowing merge.

---

## Reporting Bugs

Please include:
- Browser/OS version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

---

_Thanks for helping make the Idleon community tools better!_
