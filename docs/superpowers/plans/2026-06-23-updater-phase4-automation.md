# Updater Phase 4 — Event-Driven Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A GitHub Actions workflow that cheaply watches the live N.js via its HTTP `ETag`, and on a real change runs the existing detection + golden pipeline, applies the mechanical game-data regen, opens a **draft PR** `auto-update-<sha>`, and posts a Discord notification — never merging to main (human gate). The agentic formula-fix is then performed by Claude from the PR.

**Architecture:** Event-driven via the N.js `ETag` (a `HEAD` request reads the server's content fingerprint without downloading the ~25 MB bundle). A short cron (~30 min) runs the cheap gate; only on an ETag change does the heavy pipeline run. Detection + mechanical fixes + validation happen in CI and land in a draft PR; the risky formula porting stays under Claude's reasoning + the human merge gate. Notification from CI uses a native Discord channel webhook (the MCP bot is used only when a fix runs inside a Claude session).

**Tech Stack:** TypeScript + `tsx` (Node 20), the existing `web/scripts/updater/` orchestrator (`run.ts`, `fetch-njs.ts`, `extract.ts`, `diff.ts`, `golden/`), GitHub Actions (`gh` CLI with `GITHUB_TOKEN`), Discord channel webhook. Conventions mirror `.github/workflows/refresh-top-max.yml`.

---

## File Structure

- **Modify** `web/scripts/updater/fetch-njs.ts` — add `headNjs()` (cheap HEAD → `{etag,lastModified,byteLength}`); have `fetchNjs()` also return the `etag` from the GET response so the orchestrator can persist it.
- **Modify** `web/scripts/updater/run.ts` — add `etag` to the `Meta` type; persist it on every snapshot write; refresh `meta.etag` even on the SHA-match no-op path (so the cheap gate has an up-to-date baseline without a content change).
- **Create** `web/scripts/updater/check-njs-changed.ts` — standalone cheap gate: HEAD N.js, compare `etag` against `meta.json`, emit `changed=true|false` to `$GITHUB_OUTPUT`. Always exits 0.
- **Create** `web/scripts/updater/ci/notify-discord.ts` — POST a summary + PR link to `DISCORD_WEBHOOK_URL`. Pure formatting helper + a thin fetch wrapper.
- **Create** `.github/workflows/idleon-update-watch.yml` — the cron workflow (gate → pipeline → validate → draft PR → Discord).
- **Create** `web/__tests__/updater/check-njs.test.ts` — unit tests for the etag-compare decision and the Discord message formatter.
- **Create** `docs/superpowers/runbooks/2026-06-23-updater-phase4-runbook.md` — the agentic-fix runbook + one-time setup (Discord webhook secret, enabling the workflow).

---

## Task 1: `headNjs()` + `fetchNjs` returns etag

**Files:**
- Modify: `web/scripts/updater/fetch-njs.ts`
- Test: `web/__tests__/updater/check-njs.test.ts` (created in Task 5; Task 1 has no isolated test — it's a thin network wrapper)

- [ ] **Step 1: Add `headNjs()` and extend `FetchedNjs` with `etag`**

In `web/scripts/updater/fetch-njs.ts`, add the `etag` field to `FetchedNjs`, read it from the GET response, and add a `headNjs()` helper:

```ts
export type FetchedNjs = { text: string; sha256: string; byteLength: number; etag: string | null };

/** Downloads the live N.js to `destPath` and returns its text + hash + etag. */
export async function fetchNjs(destPath: string): Promise<FetchedNjs> {
  const res = await fetch(NJS_URL, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`fetch N.js failed: HTTP ${res.status} ${res.statusText}`);
  }
  const etag = res.headers.get("etag");
  const text = await res.text();
  if (text.length < 1_000_000) {
    throw new Error(`downloaded N.js looks wrong: only ${text.length} bytes`);
  }
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, text, "utf8");
  return { text, sha256: sha256(text), byteLength: Buffer.byteLength(text, "utf8"), etag };
}

export type NjsHead = { etag: string | null; lastModified: string | null; byteLength: number | null };

/** Cheap change-probe: reads the server's ETag/Last-Modified without downloading
 *  the ~25 MB body. The ETag changes whenever the bundle's mtime/size changes. */
export async function headNjs(): Promise<NjsHead> {
  const res = await fetch(NJS_URL, { method: "HEAD", redirect: "follow" });
  if (!res.ok) {
    throw new Error(`HEAD N.js failed: HTTP ${res.status} ${res.statusText}`);
  }
  const cl = res.headers.get("content-length");
  return {
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
    byteLength: cl ? Number(cl) : null,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit 2>&1 | grep -E "fetch-njs|scripts/updater" || echo "no updater type errors"`
Expected: `no updater type errors` (the 3 known pre-existing errors are in `__tests__/components/*` only).

- [ ] **Step 3: Commit**

```bash
git add web/scripts/updater/fetch-njs.ts
git commit -m "feat(updater): headNjs() cheap ETag probe + fetchNjs returns etag"
```

---

## Task 2: Persist `etag` in `meta.json` (including the no-op path)

**Files:**
- Modify: `web/scripts/updater/run.ts`

- [ ] **Step 1: Add `etag` to the `Meta` type**

In `web/scripts/updater/run.ts`, change:

```ts
type Meta = { sha256: string; byteLength: number; lastSteamCheck: number };
```
to:
```ts
type Meta = { sha256: string; byteLength: number; lastSteamCheck: number; etag?: string | null };
```

- [ ] **Step 2: Capture the etag from the live fetch**

In `main()`, the live-fetch branch currently discards headers. Capture the etag (default `null` for the `--no-fetch` seeding path):

```ts
  let text: string;
  let curSha: string;
  let curBytes: number;
  let curEtag: string | null = null;
  if (NO_FETCH) {
    if (!existsSync(ROOT_NJS)) throw new Error(`--no-fetch but ${ROOT_NJS} is missing`);
    text = readFileSync(ROOT_NJS, "utf8");
    curSha = sha256(text);
    curBytes = Buffer.byteLength(text, "utf8");
    console.log(`[updater] usando N.js local: ${ROOT_NJS} (${curBytes} bytes)`);
  } else {
    const dest = resolve(CACHE_DIR, "N.new.js");
    console.log(`[updater] baixando N.js live…`);
    const got = await fetchNjs(dest);
    text = got.text;
    curSha = got.sha256;
    curBytes = got.byteLength;
    curEtag = got.etag;
    console.log(`[updater] baixado: ${curBytes} bytes → ${dest}`);
  }
```

- [ ] **Step 3: Refresh `meta.etag` on the SHA-match no-op path**

Replace the early no-op return:

```ts
  if (!isFirst && prevMeta!.sha256 === curSha) {
    console.log("[updater] ✅ sem mudanças — hash idêntico ao baseline. Nada a fazer.");
    return;
  }
```
with a version that keeps the cheap ETag gate's baseline fresh when the content is unchanged but the etag drifted (e.g. a re-deploy of identical bytes, or first time seeding the etag):

```ts
  if (!isFirst && prevMeta!.sha256 === curSha) {
    if (!NO_FETCH && !DRY && curEtag && prevMeta!.etag !== curEtag) {
      writeJson(P.meta, { ...prevMeta!, etag: curEtag } satisfies Meta);
      console.log(`[updater] ✅ sem mudança de conteúdo — etag atualizado (${curEtag}). Nada mais a fazer.`);
    } else {
      console.log("[updater] ✅ sem mudanças — hash idêntico ao baseline. Nada a fazer.");
    }
    return;
  }
```

- [ ] **Step 4: Write `etag` in both persist blocks**

In the `isFirst` (seed) block and the main diff-persist block, add `etag: curEtag` to the `writeJson(P.meta, …)` calls:

```ts
    writeJson(P.meta, { sha256: curSha, byteLength: curBytes, lastSteamCheck: newSteamCheck, etag: curEtag } satisfies Meta);
```
(There are two such `writeJson(P.meta, …)` lines — update both.)

- [ ] **Step 5: Typecheck + smoke test (no-op path)**

Run: `cd web && npx tsc --noEmit 2>&1 | grep -E "scripts/updater" || echo "no updater type errors"`
Expected: `no updater type errors`.

Run (seeds the etag against the current baseline if the live sha matches): `cd web && npx tsx scripts/updater/run.ts` — observe either "etag atualizado" (seeded) or a real diff report. This is safe: `--dry` is NOT passed only if you want it to write; for a pure check use `--dry`.

- [ ] **Step 6: Commit**

```bash
git add web/scripts/updater/run.ts
git commit -m "feat(updater): persist N.js etag in meta.json (incl. no-op refresh)"
```

---

## Task 3: `check-njs-changed.ts` cheap gate

**Files:**
- Create: `web/scripts/updater/check-njs-changed.ts`
- Test: `web/__tests__/updater/check-njs.test.ts` (Task 5)

- [ ] **Step 1: Write the gate script**

```ts
// Cheap N.js change gate for the update-watch workflow. Reads the live ETag via
// a HEAD request (no ~25 MB download) and compares it to the committed baseline
// in meta.json. Emits `changed=true|false` (+ the live etag) to $GITHUB_OUTPUT.
// Always exits 0 — the workflow decides what to do with the output.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { headNjs } from "./fetch-njs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const META = resolve(__dirname, "../../data/njs-snapshot/meta.json");

function setOutput(key: string, val: string): void {
  const out = process.env.GITHUB_OUTPUT;
  if (out) appendFileSync(out, `${key}=${val}\n`);
}

/** Pure decision: changed when there is no baseline etag or it differs. */
export function etagChanged(baselineEtag: string | null | undefined, liveEtag: string | null): boolean {
  if (!baselineEtag) return true; // no baseline yet → force one processing run
  return baselineEtag !== liveEtag;
}

async function main(): Promise<void> {
  const head = await headNjs();
  const meta = existsSync(META) ? JSON.parse(readFileSync(META, "utf8")) : {};
  const baselineEtag: string | null = meta.etag ?? null;
  const changed = etagChanged(baselineEtag, head.etag);
  console.log(
    `[check] live etag=${head.etag} lastMod=${head.lastModified} | ` +
      `baseline etag=${baselineEtag ?? "(none)"} → ${changed ? "CHANGED" : "unchanged"}`,
  );
  setOutput("changed", changed ? "true" : "false");
  setOutput("etag", head.etag ?? "");
}

main().catch((e) => {
  console.error("[check] ERRO:", (e as Error).message);
  // Network hiccup → treat as "no change" so we don't open a broken PR.
  setOutput("changed", "false");
  process.exit(0);
});
```

- [ ] **Step 2: Smoke test locally**

Run: `cd web && npx tsx scripts/updater/check-njs-changed.ts`
Expected: a `[check] live etag=… → CHANGED|unchanged` line, exit 0. (CHANGED is expected until Task 2 has seeded `meta.etag`.)

- [ ] **Step 3: Commit**

```bash
git add web/scripts/updater/check-njs-changed.ts
git commit -m "feat(updater): cheap ETag gate script for the update-watch workflow"
```

---

## Task 4: `notify-discord.ts`

**Files:**
- Create: `web/scripts/updater/ci/notify-discord.ts`
- Test: `web/__tests__/updater/check-njs.test.ts` (Task 5)

- [ ] **Step 1: Write the notifier (pure formatter + thin POST)**

```ts
// Posts an update-watch summary to a Discord channel webhook (DISCORD_WEBHOOK_URL).
// Used by CI (the MCP Discord bot is only available inside a Claude session).
//   npx tsx scripts/updater/ci/notify-discord.ts "<prUrl>" "<status>" "<sha12>"
// status: "clean" (build+tests+golden green) | "needs-human" (something failed)

export function buildDiscordMessage(prUrl: string, status: string, sha12: string): string {
  const head =
    status === "clean"
      ? "🟢 **Idleon update detectado** — mecânico aplicado e validado."
      : "🟠 **Idleon update detectado** — precisa de revisão humana (fórmulas a portar / validação falhou).";
  return [
    head,
    `• N.js \`${sha12}\``,
    `• PR (draft, não-mergeado): ${prUrl}`,
    status === "clean"
      ? "• Próximo passo: revisar o diff e mergear."
      : "• Próximo passo: rodar o Claude no PR para portar as fórmulas sinalizadas (ver runbook), até o golden ficar verde.",
  ].join("\n");
}

async function main(): Promise<void> {
  const [prUrl = "", status = "needs-human", sha12 = "?"] = process.argv.slice(2);
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.warn("[notify] DISCORD_WEBHOOK_URL ausente — pulando notificação.");
    return;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: buildDiscordMessage(prUrl, status, sha12) }),
  });
  if (!res.ok) {
    console.error(`[notify] Discord webhook HTTP ${res.status}`);
    process.exit(1);
  }
  console.log("[notify] Discord notificado.");
}

main().catch((e) => {
  console.error("[notify] ERRO:", (e as Error).message);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit 2>&1 | grep -E "scripts/updater" || echo "no updater type errors"`
Expected: `no updater type errors`.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/updater/ci/notify-discord.ts
git commit -m "feat(updater): Discord channel-webhook notifier for CI"
```

---

## Task 5: Unit tests for the gate decision + Discord formatter

**Files:**
- Create: `web/__tests__/updater/check-njs.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { etagChanged } from "../../scripts/updater/check-njs-changed";
import { buildDiscordMessage } from "../../scripts/updater/ci/notify-discord";

describe("etagChanged", () => {
  it("treats a missing baseline as changed (forces a seeding run)", () => {
    expect(etagChanged(null, '"abc"')).toBe(true);
    expect(etagChanged(undefined, '"abc"')).toBe(true);
  });
  it("is unchanged when baseline equals live", () => {
    expect(etagChanged('"abc"', '"abc"')).toBe(false);
  });
  it("is changed when the live etag differs", () => {
    expect(etagChanged('"abc"', '"def"')).toBe(true);
  });
});

describe("buildDiscordMessage", () => {
  it("clean status mentions merge as the next step", () => {
    const m = buildDiscordMessage("https://gh/pr/1", "clean", "8754fec3");
    expect(m).toContain("🟢");
    expect(m).toContain("8754fec3");
    expect(m).toContain("mergear");
  });
  it("needs-human status points at the runbook", () => {
    const m = buildDiscordMessage("https://gh/pr/1", "needs-human", "8754fec3");
    expect(m).toContain("🟠");
    expect(m).toContain("runbook");
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd web && npx vitest run __tests__/updater/check-njs.test.ts`
Expected: 5 passing.

- [ ] **Step 3: Commit**

```bash
git add web/__tests__/updater/check-njs.test.ts
git commit -m "test(updater): ETag gate decision + Discord message formatter"
```

---

## Task 6: The `idleon-update-watch` workflow

**Files:**
- Create: `.github/workflows/idleon-update-watch.yml`

- [ ] **Step 1: Write the workflow**

Mirrors `refresh-top-max.yml` conventions (checkout → setup-node 20 → `npm ci` in `web/` → run tsx; git ops at repo root as `github-actions[bot]`). `gh` uses the built-in token.

```yaml
name: Idleon update watch

# Cheap ETag gate every 30 min: a HEAD on the live N.js compares the server's
# content fingerprint to the committed baseline (no ~25 MB download). On a real
# change it runs the detection + mechanical regen + golden pipeline, opens a
# DRAFT PR auto-update-<sha>, and pings Discord. Never merges to main.
on:
  schedule:
    - cron: "*/30 * * * *"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

concurrency:
  group: idleon-update-watch
  cancel-in-progress: false

jobs:
  watch:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: web/package-lock.json

      - name: Install npm dependencies
        working-directory: web
        run: npm ci

      - name: Cheap ETag gate
        id: gate
        working-directory: web
        run: npx tsx scripts/updater/check-njs-changed.ts

      - name: Skip if an auto-update PR is already open
        id: openpr
        if: steps.gate.outputs.changed == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          n=$(gh pr list --state open --search "head:auto-update-" --json number --jq 'length')
          echo "Open auto-update PRs: $n"
          echo "open=$n" >> "$GITHUB_OUTPUT"

      - name: Run detection + mechanical regen
        id: pipeline
        if: steps.gate.outputs.changed == 'true' && steps.openpr.outputs.open == '0'
        working-directory: web
        run: npx tsx scripts/updater/run.ts --write-game-data

      - name: Validate (build + unit tests + golden)
        id: validate
        if: steps.gate.outputs.changed == 'true' && steps.openpr.outputs.open == '0'
        continue-on-error: true
        working-directory: web
        run: |
          npm run build
          npm run test
          npx tsx scripts/updater/golden/run.ts

      - name: Open draft PR + notify Discord
        if: steps.gate.outputs.changed == 'true' && steps.openpr.outputs.open == '0'
        env:
          GH_TOKEN: ${{ github.token }}
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
          VALIDATE_OUTCOME: ${{ steps.validate.outcome }}
        run: |
          set -euo pipefail
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

          SHA12=$(node -e "console.log(require('./web/data/njs-snapshot/meta.json').sha256.slice(0,12))")
          DATE=$(TZ=America/Sao_Paulo date +%Y-%m-%d)
          BRANCH="auto-update-$SHA12"
          REPORT="web/data/njs-snapshot/reports/report-$DATE.md"

          # Nothing structural to commit? (e.g. only a minified rename) → no PR.
          git add web/data/njs-snapshot web/lib/arkh/stats/data/game
          if git diff --cached --quiet; then
            echo "No structural changes to commit — skipping PR."
            exit 0
          fi

          git checkout -b "$BRANCH"
          git commit -m "chore(auto-update): N.js $SHA12 snapshot + mechanical game-data"
          git push -u origin "$BRANCH"

          if [ "$VALIDATE_OUTCOME" = "success" ]; then
            STATUS="clean"; LABEL="auto-update"
          else
            STATUS="needs-human"; LABEL="needs-human"
          fi

          BODY_FILE="$REPORT"
          [ -f "$BODY_FILE" ] || { echo "Game update detected; report missing." > /tmp/body.md; BODY_FILE=/tmp/body.md; }

          PR_URL=$(gh pr create --draft --base main --head "$BRANCH" \
            --title "Auto-update $DATE — N.js $SHA12 ($STATUS)" \
            --body-file "$BODY_FILE")
          echo "PR: $PR_URL"
          gh pr edit "$PR_URL" --add-label "$LABEL" || true

          ( cd web && npx tsx scripts/updater/ci/notify-discord.ts "$PR_URL" "$STATUS" "$SHA12" ) || true
```

- [ ] **Step 2: Validate YAML syntax**

Run: `cd web && npx --yes js-yaml ../.github/workflows/idleon-update-watch.yml > /dev/null && echo "yaml ok"` (or any available YAML linter).
Expected: `yaml ok` (no parse error).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/idleon-update-watch.yml
git commit -m "feat(ci): idleon-update-watch workflow (ETag gate → draft PR + Discord)"
```

---

## Task 7: Runbook + one-time setup doc

**Files:**
- Create: `docs/superpowers/runbooks/2026-06-23-updater-phase4-runbook.md`

- [ ] **Step 1: Write the runbook**

````markdown
# Updater Phase 4 — Runbook

## One-time setup (human, once)
1. **Discord channel webhook:** in the target Discord channel → Settings → Integrations → Webhooks → New Webhook → copy URL.
2. **GitHub secret:** repo → Settings → Secrets and variables → Actions → New repository secret → name `DISCORD_WEBHOOK_URL`, paste the URL.
3. **Labels:** create labels `auto-update` and `needs-human` (Issues → Labels) so `gh pr edit --add-label` succeeds.
4. **Enable the workflow:** the cron is active once `.github/workflows/idleon-update-watch.yml` is on `main`. Trigger a first manual run via Actions → "Idleon update watch" → Run workflow (seeds `meta.etag`).

## What the workflow does automatically
- Every ~30 min: HEAD the live N.js, compare ETag to `web/data/njs-snapshot/meta.json`. Unchanged → no-op.
- On change (and no auto-update PR already open): downloads N.js, runs `run.ts --write-game-data` (snapshots + mechanical game-data + impact report), validates (`build` + `test` + golden), opens a **draft PR** `auto-update-<sha>`, and pings Discord.

## When you get a Discord ping (agentic fix — run Claude)
1. Open the PR; read `web/data/njs-snapshot/reports/report-<date>.md` (impact report) — especially the **Impacto nas fórmulas portadas** section (mapped → "revise <file>"; uncatalogued → investigate).
2. Check out the PR branch. For each flagged ported formula, port it the same way as the Cards Total LV fix: extract the authoritative expression from `web/data/njs-snapshot/formulas.json` (and `web/scripts/it-source` for the readable TS), compare term-by-term against our port, fix the divergence.
3. Re-run the golden harness until green: `cd web && npx tsx scripts/updater/golden/run.ts`. Add a synthetic case (`scripts/updater/golden/cases.ts`) for any new term real saves don't reach.
4. **Golden rule:** never commit a formula that didn't pass golden. If unsure, leave the code as-is and keep the `⚠️ precisa de humano` note in the PR.
5. When green: mark the PR ready for review, then **you** merge to main (the gate).

## Notes
- One open auto-update PR at a time: if a PR is open, the workflow skips new runs until it's merged/closed (a second update while one is pending is caught on the next run after merge).
- If validation failed (`needs-human`), the PR carries the `needs-human` label and the Discord ping says so.
````

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/runbooks/2026-06-23-updater-phase4-runbook.md
git commit -m "docs(updater): Phase 4 runbook + one-time setup"
```

---

## Self-Review Notes

- **Spec coverage:** ETag trigger (Tasks 1,3 + workflow) ✓; hash-confirm before heavy work (run.ts already content-hashes; Task 2 keeps etag fresh) ✓; mechanical apply (`--write-game-data`, existing) ✓; validation tsc/golden/tests (workflow uses `build`+`test`+golden to dodge the pre-existing `__tests__/components` tsc errors) ✓; golden rule + flag-not-invent (runbook + impact report) ✓; draft PR `auto-update-<sha>` no-merge ✓; Discord notification ✓; human gate ✓.
- **Idempotency:** keyed by an open `auto-update-*` PR (skip while one is pending) + `git diff --cached --quiet` (no PR when nothing structural changed). Branch name uses the N.js sha so re-runs target the same branch.
- **Error handling:** gate network failure → `changed=false` (no broken PR); validation failure → `continue-on-error` + `needs-human` label, PR still opens so the human/Claude can fix.
- **Known caveat (called out, not silently handled):** CI golden fetches live top-player profiles; if the IT endpoint is down the golden step fails → PR is marked `needs-human` rather than blocking detection.
- **Type consistency:** `Meta.etag?: string|null`, `FetchedNjs.etag: string|null`, `NjsHead.etag: string|null`, `etagChanged(baseline, live)`, `buildDiscordMessage(prUrl,status,sha12)` used consistently across tasks.
- **Out of scope (v2):** headless-Claude auto-fix in CI; RSS webhook for instant big-patch reaction; the it-resync step (Phase 2, deferred).
