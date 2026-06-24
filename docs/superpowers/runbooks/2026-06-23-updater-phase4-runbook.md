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
