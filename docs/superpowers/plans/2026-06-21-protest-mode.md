# Protest Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Temporarily turn the whole Idleon trackers site into a single protest page that explains a game bug and asks the community to report it on Discord, with every other route redirecting to it — toggleable by one code flag.

**Architecture:** A `PROTEST_MODE` constant in `web/lib/protest/config.ts` drives a Next.js middleware that 307-redirects every route (except `/protest` and assets) to `/protest`. The `TopNav` hides itself while the flag is on. Flipping the flag to `false` (or `git revert`) restores the site; the original pages are never modified.

**Tech Stack:** Next.js 16 (App Router, middleware), React 19, TypeScript, Tailwind CSS 3, Vitest + happy-dom + @testing-library/react.

---

## Conventions for every task

- **All commands run from inside `web/`** (the Next app root). Paths in this plan are relative to the repo root.
- Run a single test file with: `npx vitest run <path-from-web>`.
- The alias `@` resolves to `web/` (both in `tsconfig` and `vitest.config.ts`), so `@/lib/protest/config` → `web/lib/protest/config.ts`.
- Stage only the files named in each commit (no `git add -A`). We are on branch `atualizacao-idleon-jun19`.

## File Structure

| File | Responsibility |
|---|---|
| `web/lib/protest/config.ts` | **Create.** The `PROTEST_MODE` flag + all protest copy (Discord link, headline, bug text, steps, report). Single source of truth. |
| `web/middleware.ts` | **Create.** Redirects every matched route to `/protest` when the flag is on; no-op when off. |
| `web/components/TopNav.tsx` | **Modify.** Return `null` (after the existing hooks) when the flag is on. |
| `web/app/protest/CopyReportButton.tsx` | **Create.** Client component: copies the report text to the clipboard with "Copied!" feedback. |
| `web/app/protest/page.tsx` | **Create.** Server component: the protest page UI + `noindex` metadata. |
| `web/__tests__/middleware.test.ts` | **Create.** Tests the middleware redirect/passthrough behavior. |
| `web/__tests__/components/TopNav.test.tsx` | **Modify.** Mock the config (off) so existing tests keep rendering the nav. |
| `web/__tests__/components/TopNav.protest.test.tsx` | **Create.** Asserts the nav is gone when the flag is on. |
| `web/__tests__/app/CopyReportButton.test.tsx` | **Create.** Tests the copy behavior. |
| `web/__tests__/app/protest-page.test.tsx` | **Create.** Tests the page renders headline, Discord link, and is noindex. |

---

### Task 1: Protest config module

This is static data (no behavior), so it ships without its own test — the tasks that consume it (middleware, TopNav, page) test it indirectly.

**Files:**
- Create: `web/lib/protest/config.ts`

- [ ] **Step 1: Create the config file**

```ts
// web/lib/protest/config.ts

// Single switch for protest mode. Flip to `false` (or `git revert` the protest
// commit) to instantly restore the whole site to normal.
export const PROTEST_MODE = true;

// All user-facing protest copy lives here so the page/middleware stay logic-only.
export const PROTEST = {
  discordInvite: "https://discord.gg/bTcgBgnv",
  bugReportChannel: "#bug-reports",
  headline: "THE TRACKERS ARE ON STRIKE",
  subhead:
    "Every tool on this site is offline on purpose — and will stay offline until a game-breaking bug is fixed.",
  whatsBroken: [
    "A game bug prevents players from accessing characters located on World 1, 2 and 3 maps — the account becomes effectively unplayable.",
    'It only affects accounts that had a dungeon XP overflow before the Caverns update. That update "fixed" the overflow — but introduced this bug as a side effect.',
  ],
  steps: [
    "Join the official Idleon Discord",
    "Go to the #bug-reports channel",
    "Paste the report below — that's it",
  ],
  reportText:
    "🐛 Bug: After the Caverns update (the one that fixed the dungeon XP overflow), I can't access characters located on World 1–3 maps. Only happens on accounts that had a dungeon XP overflow before that update. The account is now unplayable. Please prioritize a fix 🙏",
} as const;
```

- [ ] **Step 2: Type-check it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/protest/config.ts
git commit -m "feat(protest): add protest-mode config (flag + content)"
```

---

### Task 2: Redirect middleware

**Files:**
- Create: `web/middleware.ts`
- Test: `web/__tests__/middleware.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/__tests__/middleware.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

beforeEach(() => {
  // Each test re-imports the middleware with a fresh config mock.
  vi.resetModules();
});

async function loadMiddleware(protestMode: boolean) {
  vi.doMock("@/lib/protest/config", () => ({ PROTEST_MODE: protestMode }));
  return (await import("@/middleware")).middleware;
}

describe("protest middleware", () => {
  it("redirects any route to /protest with a 307 when protest mode is on", async () => {
    const middleware = await loadMiddleware(true);
    const res = middleware(new NextRequest(new URL("https://site.test/leaderboards")));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://site.test/protest");
  });

  it("lets the /protest route through when protest mode is on", async () => {
    const middleware = await loadMiddleware(true);
    const res = middleware(new NextRequest(new URL("https://site.test/protest")));
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes everything through when protest mode is off", async () => {
    const middleware = await loadMiddleware(false);
    const res = middleware(new NextRequest(new URL("https://site.test/leaderboards")));
    expect(res.headers.get("location")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/middleware.test.ts`
Expected: FAIL — `Cannot find module '@/middleware'` (file doesn't exist yet).

- [ ] **Step 3: Write the middleware**

```ts
// web/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { PROTEST_MODE } from "@/lib/protest/config";

export function middleware(req: NextRequest) {
  if (!PROTEST_MODE) return NextResponse.next();

  // Don't redirect the protest page onto itself (infinite loop).
  if (req.nextUrl.pathname.startsWith("/protest")) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/protest";
  // 307 (temporary) so search engines keep the original URLs as canonical.
  return NextResponse.redirect(url, 307);
}

export const config = {
  // Run on everything except Next internals, Vercel internals, the favicon,
  // and any file with an extension (static assets) — so the protest page keeps
  // its styles and analytics keep working.
  matcher: ["/((?!_next/|_vercel/|favicon.ico|.*\\.).*)"],
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/middleware.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/middleware.ts web/__tests__/middleware.test.ts
git commit -m "feat(protest): redirect all routes to /protest via middleware"
```

---

### Task 3: Hide the TopNav while on strike

The existing `TopNav.test.tsx` renders the nav, so it must mock the flag as `false` or it would break once the guard exists. A new file covers the `true` case (static mock per file keeps each test simple).

**Files:**
- Modify: `web/components/TopNav.tsx`
- Modify: `web/__tests__/components/TopNav.test.tsx`
- Create: `web/__tests__/components/TopNav.protest.test.tsx`

- [ ] **Step 1: Update the existing test to mock the flag (off)**

Add this mock right after the existing `vi.mock("next/navigation", ...)` block near the top of `web/__tests__/components/TopNav.test.tsx`:

```ts
// Existing tests assert the nav renders, so keep protest mode off here.
vi.mock("@/lib/protest/config", () => ({ PROTEST_MODE: false }));
```

The rest of the file stays unchanged.

- [ ] **Step 2: Write the new failing test**

```tsx
// web/__tests__/components/TopNav.protest.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/protest/config", () => ({ PROTEST_MODE: true }));

import TopNav from "@/components/TopNav";

describe("TopNav during protest mode", () => {
  it("renders nothing so the tools can't be reached from the nav", () => {
    const { container } = render(<TopNav />);
    expect(container.querySelector("nav")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 3: Run the new test to verify it fails**

Run: `npx vitest run __tests__/components/TopNav.protest.test.tsx`
Expected: FAIL — the `<nav>` still renders (guard not added yet).

- [ ] **Step 4: Add the guard to TopNav**

In `web/components/TopNav.tsx`, add the import at the top with the other imports:

```tsx
import { PROTEST_MODE } from "@/lib/protest/config";
```

Then, inside `export default function TopNav()`, add the guard **immediately before the `return (`** (i.e. after the existing `useEffect(...)` call). It must come after the hooks so the hook order stays stable (`react-hooks/rules-of-hooks`):

```tsx
  // Protest mode: hide the whole nav so every tool is unreachable from here.
  // Placed after the hooks above so their call order stays stable.
  if (PROTEST_MODE) return null;
```

- [ ] **Step 5: Run both TopNav test files to verify they pass**

Run: `npx vitest run __tests__/components/TopNav.test.tsx __tests__/components/TopNav.protest.test.tsx`
Expected: PASS (existing 3 tests + new 1).

- [ ] **Step 6: Commit**

```bash
git add web/components/TopNav.tsx web/__tests__/components/TopNav.test.tsx web/__tests__/components/TopNav.protest.test.tsx
git commit -m "feat(protest): hide TopNav while protest mode is on"
```

---

### Task 4: Copy-report button (client component)

**Files:**
- Create: `web/app/protest/CopyReportButton.tsx`
- Test: `web/__tests__/app/CopyReportButton.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/__tests__/app/CopyReportButton.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CopyReportButton from "@/app/protest/CopyReportButton";
import { PROTEST } from "@/lib/protest/config";

describe("CopyReportButton", () => {
  it("copies the report text and shows feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // happy-dom has no clipboard by default — provide one.
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CopyReportButton />);
    fireEvent.click(screen.getByRole("button"));

    expect(writeText).toHaveBeenCalledWith(PROTEST.reportText);
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/app/CopyReportButton.test.tsx`
Expected: FAIL — `Cannot find module '@/app/protest/CopyReportButton'`.

- [ ] **Step 3: Write the component**

```tsx
// web/app/protest/CopyReportButton.tsx
"use client";

import { useState } from "react";
import { PROTEST } from "@/lib/protest/config";

export default function CopyReportButton() {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(PROTEST.reportText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-md bg-zinc-800 px-4 py-2.5 text-sm font-bold text-zinc-100 transition-colors hover:bg-zinc-700"
    >
      {copied ? "Copied!" : "⧉ Copy report"}
    </button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/app/CopyReportButton.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/protest/CopyReportButton.tsx web/__tests__/app/CopyReportButton.test.tsx
git commit -m "feat(protest): add CopyReportButton for the bug report"
```

---

### Task 5: The protest page

**Files:**
- Create: `web/app/protest/page.tsx`
- Test: `web/__tests__/app/protest-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/__tests__/app/protest-page.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProtestPage, { metadata } from "@/app/protest/page";
import { PROTEST } from "@/lib/protest/config";

describe("ProtestPage", () => {
  it("shows the headline and the bug explanation", () => {
    render(<ProtestPage />);
    expect(
      screen.getByRole("heading", { name: PROTEST.headline })
    ).toBeInTheDocument();
    expect(screen.getByText(/What.s broken/i)).toBeInTheDocument();
  });

  it("links to the official Discord in a new tab", () => {
    render(<ProtestPage />);
    const link = screen.getByRole("link", { name: /Report on Discord/i });
    expect(link).toHaveAttribute("href", PROTEST.discordInvite);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("is excluded from search indexing", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/app/protest-page.test.tsx`
Expected: FAIL — `Cannot find module '@/app/protest/page'`.

- [ ] **Step 3: Write the page**

```tsx
// web/app/protest/page.tsx
import type { Metadata } from "next";
import { PROTEST } from "@/lib/protest/config";
import CopyReportButton from "./CopyReportButton";

export const metadata: Metadata = {
  title: { absolute: "We're on strike — Arkh's Idleon Trackers" },
  robots: { index: false, follow: false },
};

// Caution-tape stripes (no native Tailwind util for repeating gradients).
const STRIPES: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, #f59e0b, #f59e0b 14px, #18181b 14px, #18181b 28px)",
};

export default function ProtestPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="h-3.5 rounded-sm" style={STRIPES} />

      <header className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="text-5xl">📢</div>
        <h1 className="text-3xl font-extrabold tracking-wide text-amber-400 sm:text-4xl">
          {PROTEST.headline}
        </h1>
        <p className="max-w-xl leading-relaxed text-zinc-300">{PROTEST.subhead}</p>
      </header>

      <section className="mb-5 rounded-lg border border-zinc-800 border-l-4 border-l-red-500 bg-zinc-900 p-5">
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-red-500">
          ⚠ What&rsquo;s broken
        </h2>
        {PROTEST.whatsBroken.map((line, i) => (
          <p key={i} className="mb-2 text-sm leading-relaxed text-zinc-300 last:mb-0">
            {line}
          </p>
        ))}
      </section>

      <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-xs font-extrabold uppercase tracking-wide text-gold">
          ✊ Help get it fixed
        </h2>
        <ol className="mb-4 flex flex-col gap-3">
          {PROTEST.steps.map((step, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-gold text-[11px] font-extrabold text-zinc-950">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <pre className="whitespace-pre-wrap rounded-md border border-dashed border-zinc-700 bg-zinc-950 p-3 font-mono text-[12px] leading-relaxed text-zinc-400">
{PROTEST.reportText}
        </pre>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <CopyReportButton />
          <a
            href={PROTEST.discordInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-[#5865F2] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#4752c4]"
          >
            Report on Discord →
          </a>
        </div>
      </section>

      <div className="h-3.5 rounded-sm" style={STRIPES} />
    </main>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/app/protest-page.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/app/protest/page.tsx web/__tests__/app/protest-page.test.tsx
git commit -m "feat(protest): add the /protest page"
```

---

### Task 6: Full verification

No new code — prove the whole thing compiles, lints, and the suite is green with the flag in its real (`true`) state.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all files, including the new middleware / TopNav / protest tests.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors; no lint errors (in particular no `react-hooks/rules-of-hooks` error from the TopNav guard).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds. The build compiles `middleware.ts` and the `/protest` route. (Do **not** run `next dev` — verify visually on the Vercel preview deploy after pushing.)

- [ ] **Step 4: Push the branch**

```bash
git push origin atualizacao-idleon-jun19
```

Then confirm the protest page renders correctly on the Vercel preview/deploy, and that visiting any other route (e.g. `/leaderboards`) redirects to `/protest`.

---

## Reversal (when the game bug is fixed)

1. Set `PROTEST_MODE = false` in `web/lib/protest/config.ts` (or `git revert` the protest commits), commit, and push → Vercel redeploys and the site is back to normal.
2. Optional later cleanup: delete `web/app/protest/` and `web/middleware.ts`.

---

## Self-Review (done while writing)

- **Spec coverage:** flag (`PROTEST_MODE`) ✓ Task 1; middleware 307 redirect + matcher ✓ Task 2; TopNav hidden ✓ Task 3; copy button ✓ Task 4; page content + noindex ✓ Task 5; tests for middleware/TopNav/page ✓; reversal documented ✓.
- **Placeholder scan:** none — every step has full code/commands.
- **Type consistency:** `PROTEST_MODE` and `PROTEST` (with fields `discordInvite`, `headline`, `subhead`, `whatsBroken`, `steps`, `reportText`) are defined in Task 1 and used identically in Tasks 2–5. `middleware` export name matches the test import.
- **Note on the spec:** the spec showed the TopNav guard as an early top-of-function return; this plan moves it after the hooks to satisfy `react-hooks/rules-of-hooks`. Same behavior, lint-safe.
