// Generates TOME_PARITY.md — a side-by-side report comparing how we
// extract the raw quantity for each of the 118 tome tasks vs how
// IdleonToolbox (Morta1/IdleonToolbox on GitHub) extracts it.
//
// Both sides apply the SAME curve formulas to the quantity (we ported them
// 1:1 from IT), so the parity battle is entirely on the quantity-extraction
// side. The report highlights the cases where the formulas / source fields
// differ so future bug-hunts have a single reference.
//
// Mapping:
//   - TOME_TASKS[task_idx]   = task display name (0..117 in IT order)
//   - NEI32[task_idx]        = compute_idx for that task (legacy game order)
//   - compute.ts switch(compute_idx) → our extraction
//   - IT tome.ts quantities.push(...) #compute_idx → IT extraction
//
// Run: npx tsx scripts/generate-parity-report.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEI32, TOME_TASKS, TOME_BONUSES, COMPUTE_LB_FALLBACK } from "../lib/tome/tasks";

const ROOT = join(__dirname, "..");

// ─────────────────────────────────────────────────────── parse our compute.ts

function parseOurCases(): Map<number, string> {
  const src = readFileSync(join(ROOT, "lib/tome/compute.ts"), "utf8");
  // Match: case N: ... until the next "case M:" or "default:" line at same indent
  const cases = new Map<number, string>();
  const re = /^(\s*)case\s+(\d+):\s*([\s\S]*?)(?=^\s*case\s+\d+:|^\s*default:)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const idx = Number(m[2]);
    const body = m[3].trim().replace(/\n\s+/g, " ").replace(/\s+/g, " ");
    cases.set(idx, body);
  }
  return cases;
}

// ─────────────────────────────────────────────────────── parse IT tome.ts

function parseItPushes(): string[] {
  const src = readFileSync(
    join(ROOT, "scripts/it-source/parsers/world-4/tome.ts"),
    "utf8"
  );
  // Walk character-by-character. Find every "quantities.push(" anchor, then
  // count parens to capture the full argument (handles multi-line pushes).
  // After the closing paren + optional ";", swallow a trailing inline comment.
  const pushes: string[] = [];
  const marker = "quantities.push(";
  let i = 0;
  while (i < src.length) {
    const at = src.indexOf(marker, i);
    if (at < 0) break;
    let depth = 1;
    let j = at + marker.length;
    let inStr: string | null = null;
    let inLineComment = false;
    let inBlockComment = false;
    while (j < src.length && depth > 0) {
      const c = src[j];
      const next = src[j + 1];
      if (inLineComment) {
        if (c === "\n") inLineComment = false;
        j++;
        continue;
      }
      if (inBlockComment) {
        if (c === "*" && next === "/") {
          inBlockComment = false;
          j += 2;
          continue;
        }
        j++;
        continue;
      }
      if (inStr) {
        if (c === "\\") {
          j += 2;
          continue;
        }
        if (c === inStr) inStr = null;
        j++;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        inStr = c;
        j++;
        continue;
      }
      if (c === "/" && next === "/") {
        inLineComment = true;
        j += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        inBlockComment = true;
        j += 2;
        continue;
      }
      if (c === "(") depth++;
      else if (c === ")") depth--;
      if (depth === 0) break;
      j++;
    }
    // j is at the closing ")"
    const expr = src
      .slice(at + marker.length, j)
      .replace(/\s+/g, " ")
      .trim();
    // Pick up trailing comment after ");"
    let k = j + 1;
    if (src[k] === ";") k++;
    while (k < src.length && (src[k] === " " || src[k] === "\t")) k++;
    let comment = "";
    if (src[k] === "/" && src[k + 1] === "/") {
      const end = src.indexOf("\n", k);
      comment = " " + src.slice(k, end < 0 ? src.length : end).trim();
    }
    pushes.push(expr + comment);
    i = j + 1;
  }
  return pushes;
}

// ─────────────────────────────────────────────────────── classify match

type Match = "exact" | "verified-fix" | "different" | "uncertain";

// Manually curated parity confirmations. These are the cases I personally
// validated against IT (either ported 1:1 or fixed in a recent commit).
// Update when you debug a new one and confirm it matches IT's logic.
const VERIFIED_FIXES: Record<number, string> = {
  // Manually validated against IT (real-save diff hits). Compute indices —
  // look up the task name via NEI32.indexOf(<computeIdx>).
  49: "rawShinyLevelsProper — ports IT's getShinyLevelFromProgress per pet (commit 6772228)",
  51: "rawBreedability — ports IT's per-pet log/pow formula across the 4 petStats worlds (commit 6772228)",
  71: "rawSummoningWins — Summon[1].length + OptLacc[319] matches IT's flat-won-battles + highestEndlessLevel (task #22)",
  75: "rawMinigameScore — sums FamValMinigameHiscores[0..3] + OptLacc[99] pen-pals (commit 6772228)",
  116: "Unique Sushi Created — uses Sushi[5] consecutive prefix per IT sushiStation parser (commit 6772228)",
};

function classifyMatch(ours: string, it: string, computeIdx: number): Match {
  if (computeIdx in VERIFIED_FIXES) return "verified-fix";
  if (!ours || !it) return "uncertain";

  // Heuristic A: both reference the same accountOptions/OptLacc index.
  const oOpt = ours.match(/OptLacc\[(\d+)\]|accountOptions\?\.\[(\d+)\]/);
  const iOpt = it.match(/accountOptions\?\.\[(\d+)\]|OptLacc\[(\d+)\]/);
  if (oOpt && iOpt) {
    const oIdx = oOpt[1] ?? oOpt[2];
    const iIdx = iOpt[1] ?? iOpt[2];
    return oIdx === iIdx ? "exact" : "different";
  }

  // Heuristic B: shared significant noun in both expressions.
  // Pull function names + field names from both sides, compare.
  const tokens = (s: string) =>
    new Set(
      (s.match(/[a-zA-Z][a-zA-Z0-9]+/g) || [])
        .map((t) => t.toLowerCase())
        .filter(
          (t) =>
            t.length > 4 &&
            ![
              "account",
              "data",
              "return",
              "const",
              "characters",
              "value",
              "items",
              "level",
              "total",
              "calc",
              "level",
              "options",
              "stuff",
            ].includes(t)
        )
    );
  const a = tokens(ours);
  const b = tokens(it);
  const shared = [...a].filter((t) => b.has(t));
  if (shared.length >= 1) return "exact";

  return "uncertain";
}

// Extract a human-readable label for what our switch case returns.
// Tries (in order):
//   1. The string we pass to R(out, "<label>", value)   — explicit summary
//   2. The OptLacc index for O(opt, N, out) helper     — synthesizes `OptLacc[N]`
//   3. null when neither matched (caller falls back to "inline")
function extractOurLabel(body: string): string | null {
  const r = body.match(/R\(\s*out\s*,\s*"([^"]+)"/);
  if (r) return r[1];
  const o = body.match(/\bO\(\s*opt\s*,\s*(\d+)\s*,\s*out\s*\)/);
  if (o) return `OptLacc[${o[1]}]`;
  return null;
}

// ─────────────────────────────────────────────────────── render markdown

function render(): string {
  const ours = parseOurCases();
  const it = parseItPushes();

  if (it.length !== 118) {
    console.error(
      `× Expected 118 IT pushes, found ${it.length}. Aborting.`
    );
    process.exit(1);
  }

  const out: string[] = [];
  out.push("# Tome Task Parity Report");
  out.push("");
  out.push(
    `> Side-by-side comparison of how **our extractor** vs **IdleonToolbox** (Morta1/IdleonToolbox @ \`parsers/world-4/tome.ts\`) reads the raw quantity for each of the 118 tome tasks. Both apply identical curve formulas to the quantity — divergences here are the only source of pts mismatches.`
  );
  out.push("");
  out.push(`Generated: ${new Date().toISOString()}  `);
  out.push(`Source: \`scripts/generate-parity-report.ts\`  `);
  out.push(`IT pinned: cloned at \`web/scripts/it-source/\` (gitignored)`);
  out.push("");

  // ── Summary stats
  const stats = {
    exact: 0,
    verified: 0,
    different: 0,
    uncertain: 0,
    lbFallback: 0,
  };
  const rows: {
    taskIdx: number;
    computeIdx: number;
    task: string;
    ours: string;
    it: string;
    ourLabel: string | null;
    match: Match;
    bonusFlag: string;
  }[] = [];

  for (let taskIdx = 0; taskIdx < 118; taskIdx++) {
    const computeIdx = NEI32[taskIdx];
    const ourBody = ours.get(computeIdx) ?? "";
    const itBody = it[computeIdx] ?? "";
    const m = classifyMatch(ourBody, itBody, computeIdx);
    if (m === "exact") stats.exact++;
    else if (m === "verified-fix") stats.verified++;
    else if (m === "different") stats.different++;
    else stats.uncertain++;
    if (computeIdx in COMPUTE_LB_FALLBACK) stats.lbFallback++;
    const bonus = TOME_BONUSES[computeIdx];
    const bonusFlag = bonus ? `[${bonus[0]}, ${bonus[1]}, ${bonus[2]}]` : "—";
    rows.push({
      taskIdx,
      computeIdx,
      task: TOME_TASKS[taskIdx],
      ours: ourBody,
      it: itBody,
      ourLabel: extractOurLabel(ourBody),
      match: m,
      bonusFlag,
    });
  }

  out.push("## Summary");
  out.push("");
  out.push(`| Status | Count | Meaning |`);
  out.push(`| --- | ---: | --- |`);
  out.push(`| ✓ exact | ${stats.exact} | Same field / function reference on both sides (heuristic). |`);
  out.push(`| ✅ verified-fix | ${stats.verified} | Manually validated against a real save; recent bug-fix already aligned with IT. |`);
  out.push(`| ❌ different | ${stats.different} | Heuristic detected a divergence (different OptLacc index). |`);
  out.push(`| ⚠️ uncertain | ${stats.uncertain} | Heuristic couldn't classify — needs human eyes. |`);
  out.push(`| 🔁 LB fallback available | ${stats.lbFallback} | Our extractor falls back to a leaderboard if local computation returns null. |`);
  out.push(`| **TOTAL** | **118** | |`);
  out.push("");
  out.push(
    "> The classifier is conservative — \"uncertain\" doesn't mean broken, just \"the regex isn't smart enough to tell.\" In practice most uncertain rows are exact ports. Focus eyeball-review on rows you suspect after a real-save diff."
  );
  out.push("");

  // ── Compact table for scan-readability
  out.push("## Compact table");
  out.push("");
  out.push("| # | Task | computeIdx | Status | Our source label | IT push (head) |");
  out.push("| ---: | --- | ---: | :---: | --- | --- |");
  for (const r of rows) {
    const icon =
      r.match === "exact"
        ? "✓"
        : r.match === "verified-fix"
          ? "✅"
          : r.match === "different"
            ? "❌"
            : "⚠️";
    const ourCol = r.ourLabel ? `\`${r.ourLabel}\`` : "_inline_";
    const itHead = r.it
      ? "`" + truncate(r.it.replace(/`/g, ""), 70) + "`"
      : "—";
    const taskName = r.task.replace(/\|/g, "\\|");
    out.push(
      `| ${r.taskIdx} | ${taskName} | ${r.computeIdx} | ${icon} | ${ourCol} | ${itHead} |`
    );
  }
  out.push("");

  // ── Detailed task-by-task
  out.push("## Task-by-task detail (118 entries)");
  out.push("");
  out.push("Legend:");
  out.push("- **task_idx** — 0-117 in display order (matches `TOME_TASKS`)");
  out.push("- **compute_idx** — `NEI32[task_idx]`; the index our switch and IT's `quantities[]` use");
  out.push("- **Bonus** — `[x1, x2, x3]` curve params (`x2` selects the formula, `x3` is max pts)");
  out.push("- ✓ heuristically equivalent · ✅ manually verified · ❌ heuristic mismatch · ⚠️ unclassified");
  out.push("");

  for (const r of rows) {
    const icon =
      r.match === "exact"
        ? "✓"
        : r.match === "verified-fix"
          ? "✅"
          : r.match === "different"
            ? "❌"
            : "⚠️";
    const lbNote =
      r.computeIdx in COMPUTE_LB_FALLBACK
        ? ` · LB fallback \`${COMPUTE_LB_FALLBACK[r.computeIdx].join("/")}\``
        : "";
    const verifiedNote =
      r.match === "verified-fix" && VERIFIED_FIXES[r.computeIdx]
        ? `\n\n_${VERIFIED_FIXES[r.computeIdx]}_`
        : "";
    out.push(`### #${r.taskIdx} — ${r.task} ${icon}`);
    out.push("");
    out.push(
      `compute_idx \`${r.computeIdx}\` · bonus \`${r.bonusFlag}\`${lbNote}${verifiedNote}`
    );
    out.push("");
    out.push("```ts");
    out.push(`// Ours (web/lib/tome/compute.ts, case ${r.computeIdx}):`);
    out.push(r.ours ? truncate(r.ours, 600) : "(no matching case)");
    out.push("");
    out.push(`// IT (parsers/world-4/tome.ts, push #${r.computeIdx}):`);
    out.push(r.it ? truncate(r.it, 600) : "(no matching push)");
    out.push("```");
    out.push("");
  }

  return out.join("\n");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

const md = render();
const target = join(ROOT, "..", "TOME_PARITY.md");
writeFileSync(target, md);
console.log(`✓ Wrote ${target} (${md.length.toLocaleString()} chars)`);
