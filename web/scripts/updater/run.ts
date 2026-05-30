// ===== Idleon updater — orchestrator =====
// Detects what changed in the game between the versioned baseline snapshot and
// the current (live or local) N.js, and writes a human report.
//
// Usage (run from web/):
//   npx tsx scripts/updater/run.ts            # download live N.js, diff, report
//   npx tsx scripts/updater/run.ts --no-fetch # use repo-root N.js as "current"
//   npx tsx scripts/updater/run.ts --dry      # report only, don't rewrite snapshots
//
// Flow: get current N.js → extract → load baseline → diff → Steam changelog →
// write report + (unless --dry) rewrite snapshots. The snapshots live in git,
// so `git diff web/data/njs-snapshot` is itself the per-version changelog.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractAll, type Item, type Snapshot } from "./extract";
import { fetchNjs, sha256 } from "./fetch-njs";
import { diffMaps, diffSets, isMapDiffEmpty, type MapDiff } from "./diff";
import { fetchSteamNews, newsSince, type SteamNews } from "./steam";
import { buildItemsFile, buildListsFile } from "./emit-game-data";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const SNAP_DIR = resolve(REPO_ROOT, "web/data/njs-snapshot");
const REPORT_DIR = resolve(SNAP_DIR, "reports");
const CACHE_DIR = resolve(__dirname, ".cache");
const ROOT_NJS = resolve(REPO_ROOT, "N.js");
const GAME_DIR = resolve(REPO_ROOT, "web/lib/corgan/stats/data/game");

const args = new Set(process.argv.slice(2));
const NO_FETCH = args.has("--no-fetch");
const DRY = args.has("--dry");
const WRITE_GAME_DATA = args.has("--write-game-data");

/**
 * Regenerates the corgan engine's committed game-data files from the live data
 * by merging onto the existing files (never drops a committed key). This is
 * what makes the detected changes actually reach the tools (Drop Rate etc.).
 */
async function writeGameData(
  items: Record<string, Item>,
  lists: Record<string, unknown>,
): Promise<void> {
  const itemsPath = resolve(GAME_DIR, "items.js");
  const listsPath = resolve(GAME_DIR, "customlists.js");
  const committedItems = (await import(pathToFileURL(itemsPath).href)).ITEMS as Record<string, Item>;
  const listsMod = (await import(pathToFileURL(listsPath).href)) as Record<string, unknown>;
  const committedListsText = readFileSync(listsPath, "utf8");

  const it = buildItemsFile(items, committedItems);
  const ls = buildListsFile(lists, committedListsText, listsMod);
  if (DRY) {
    console.log(`[updater] (--dry) game-data NÃO gravado. itens: +${it.added} ~${it.updated}; listas: ~${ls.updated}`);
    return;
  }
  writeFileSync(itemsPath, it.text, "utf8");
  writeFileSync(listsPath, ls.text, "utf8");
  console.log(`[updater] 🛠️  game-data atualizado: items.js (+${it.added} novos, ~${it.updated} alterados, ${it.kept} preservados) · customlists.js (~${ls.updated} alteradas)`);
  if (ls.missing.length) console.log(`[updater]    listas não reextraídas (mantidas do baseline): ${ls.missing.join(", ")}`);
}

type Meta = { sha256: string; byteLength: number; lastSteamCheck: number };

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      o[k] = sortDeep((v as Record<string, unknown>)[k]);
    }
    return o;
  }
  return v;
}

function writeJson(path: string, obj: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(sortDeep(obj), null, 2) + "\n", "utf8");
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

function todaySP(): string {
  // sv-SE renders as YYYY-MM-DD; pin to the user's timezone.
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const P = {
  items: resolve(SNAP_DIR, "items.json"),
  lists: resolve(SNAP_DIR, "lists.json"),
  strings: resolve(SNAP_DIR, "strings.json"),
  meta: resolve(SNAP_DIR, "meta.json"),
};

function preview(v: unknown, max = 160): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + `… (${s.length} chars)` : s;
}

function fmtItemChanges(c: MapDiff["changed"][number]): string[] {
  const b = (c.before ?? {}) as Record<string, unknown>;
  const a = (c.after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
  const out: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) {
      out.push(`\`${k}\`: ${JSON.stringify(b[k]) ?? "∅"} → ${JSON.stringify(a[k]) ?? "∅"}`);
    }
  }
  return out;
}

function section(title: string, d: MapDiff, kind: "item" | "list"): string {
  const L: string[] = [`## ${title}`, ""];
  L.push(`- Adicionados: **${d.added.length}** · Removidos: **${d.removed.length}** · Alterados: **${d.changed.length}**`, "");
  if (d.added.length) {
    L.push(`### ➕ Novos (${d.added.length})`, "");
    for (const k of d.added) L.push(`- \`${k}\``);
    L.push("");
  }
  if (d.removed.length) {
    L.push(`### ➖ Removidos (${d.removed.length})`, "");
    for (const k of d.removed) L.push(`- \`${k}\``);
    L.push("");
  }
  if (d.changed.length) {
    L.push(`### ✏️ Alterados (${d.changed.length})`, "");
    for (const c of d.changed) {
      if (kind === "item") {
        const fields = fmtItemChanges(c);
        L.push(`- \`${c.key}\``);
        for (const f of fields.slice(0, 12)) L.push(`  - ${f}`);
        if (fields.length > 12) L.push(`  - … +${fields.length - 12} campos`);
      } else {
        L.push(`- \`${c.key}\``);
        L.push(`  - antes: \`${preview(c.before)}\``);
        L.push(`  - depois: \`${preview(c.after)}\``);
      }
    }
    L.push("");
  }
  return L.join("\n");
}

function stringsSection(diff: { added: string[]; removed: string[] }): string {
  const cap = 300;
  const L: string[] = ["## Conteúdo novo (strings)", ""];
  L.push(`- Novas: **${diff.added.length}** · Removidas: **${diff.removed.length}**`, "");
  if (diff.added.length) {
    L.push(`### ➕ Strings novas${diff.added.length > cap ? ` (primeiras ${cap} de ${diff.added.length})` : ""}`, "", "```");
    for (const s of diff.added.slice(0, cap)) L.push(s);
    L.push("```", "");
  }
  if (diff.removed.length) {
    L.push(`### ➖ Strings removidas${diff.removed.length > cap ? ` (primeiras ${cap} de ${diff.removed.length})` : ""}`, "", "```");
    for (const s of diff.removed.slice(0, cap)) L.push(s);
    L.push("```", "");
  }
  return L.join("\n");
}

function steamSection(news: SteamNews[], sinceUnix: number): string {
  const L: string[] = ["## Changelog da Steam", ""];
  if (!news.length) {
    L.push("_Não foi possível obter notas da Steam._", "");
    return L.join("\n");
  }
  L.push("_Notas mais recentes (🆕 = novas desde a última verificação)._", "");
  for (const n of news) {
    const flag = n.date > sinceUnix ? "🆕 " : "";
    L.push(`### ${flag}${n.title} — ${n.dateISO}`, "", n.contents.trim().slice(0, 2000), "", `[ver na Steam](${n.url})`, "");
  }
  return L.join("\n");
}

async function main(): Promise<void> {
  // 1. Get the "current" N.js (live download or repo-root copy for seeding).
  let text: string;
  let curSha: string;
  let curBytes: number;
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
    console.log(`[updater] baixado: ${curBytes} bytes → ${dest}`);
  }

  // 2. Load baseline.
  const prevMeta = readJson<Meta | null>(P.meta, null);
  const isFirst = prevMeta === null;

  if (!isFirst && prevMeta!.sha256 === curSha) {
    console.log("[updater] ✅ sem mudanças — hash idêntico ao baseline. Nada a fazer.");
    return;
  }

  // 3. Extract current.
  console.log("[updater] extraindo dados…");
  const cur = extractAll(text);
  console.log(
    `[updater] extraído: ${Object.keys(cur.items).length} itens · ` +
      `${Object.keys(cur.lists).length} listas · ${cur.strings.length} strings`,
  );

  // 4. Steam changelog. Always show the latest notes (the user wants "the most
  //    recent update"); separately track which are new since the last check.
  let allNews: SteamNews[] = [];
  try {
    allNews = await fetchSteamNews(5);
  } catch (e) {
    console.warn(`[updater] aviso: Steam News API falhou: ${(e as Error).message}`);
  }
  const sinceCheck = prevMeta?.lastSteamCheck ?? 0;
  const newCount = newsSince(allNews, sinceCheck).length;
  const newSteamCheck = allNews.length
    ? Math.max(sinceCheck, ...allNews.map((n) => n.date))
    : sinceCheck;

  // 4b. Optionally regenerate the engine's committed game-data files.
  if (WRITE_GAME_DATA) await writeGameData(cur.items, cur.lists);

  const today = todaySP();
  const reportPath = resolve(REPORT_DIR, `report-${today}.md`);

  if (isFirst) {
    // Seed: no diff to compute, just establish the baseline.
    const head = [
      `# Baseline inicial — ${today}`,
      "",
      `Snapshot inicial do N.js (sha \`${curSha.slice(0, 12)}\`, ${curBytes} bytes).`,
      `Itens: **${Object.keys(cur.items).length}** · Listas: **${Object.keys(cur.lists).length}** · Strings: **${cur.strings.length}**.`,
      "",
      "Sem diff (primeira execução). Próximas execuções compararão contra este baseline.",
      "",
    ].join("\n");
    const report = head + "\n" + steamSection(allNews, sinceCheck);
    if (!DRY) {
      writeJson(P.items, cur.items);
      writeJson(P.lists, cur.lists);
      writeJson(P.strings, cur.strings);
      writeJson(P.meta, { sha256: curSha, byteLength: curBytes, lastSteamCheck: newSteamCheck } satisfies Meta);
      mkdirSync(REPORT_DIR, { recursive: true });
      writeFileSync(reportPath, report, "utf8");
      console.log(`[updater] 🌱 baseline criado em ${SNAP_DIR}`);
      console.log(`[updater] 📄 relatório: ${reportPath}`);
    } else {
      console.log("[updater] (--dry) baseline NÃO gravado.");
    }
    return;
  }

  // 5. Diff against baseline.
  const prev: Pick<Snapshot, "items" | "lists" | "strings"> = {
    items: readJson(P.items, {}),
    lists: readJson(P.lists, {}),
    strings: readJson(P.strings, []),
  };
  const itemsDiff = diffMaps(prev.items, cur.items);
  const listsDiff = diffMaps(prev.lists, cur.lists);
  const stringsDiff = diffSets(prev.strings, cur.strings);

  const nothingStructural =
    isMapDiffEmpty(itemsDiff) && isMapDiffEmpty(listsDiff) &&
    stringsDiff.added.length === 0 && stringsDiff.removed.length === 0;

  const report = [
    `# Mudanças do Idleon — ${today}`,
    "",
    `Baseline \`${prevMeta!.sha256.slice(0, 12)}\` → atual \`${curSha.slice(0, 12)}\`.`,
    nothingStructural
      ? "_Bundle mudou, mas nenhum dado estruturado/string detectado mudou (provável só renomeação/minificação)._"
      : "",
    "",
    section("Itens", itemsDiff, "item"),
    section("Listas / constantes", listsDiff, "list"),
    stringsSection(stringsDiff),
    steamSection(allNews, sinceCheck),
  ].join("\n");

  // 6. Persist.
  if (!DRY) {
    writeJson(P.items, cur.items);
    writeJson(P.lists, cur.lists);
    writeJson(P.strings, cur.strings);
    writeJson(P.meta, { sha256: curSha, byteLength: curBytes, lastSteamCheck: newSteamCheck } satisfies Meta);
    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(reportPath, report, "utf8");
  }

  // 7. Console summary.
  console.log("──────────────────────────────────────────");
  console.log(`  Itens   ➕${itemsDiff.added.length} ➖${itemsDiff.removed.length} ✏️${itemsDiff.changed.length}`);
  console.log(`  Listas  ➕${listsDiff.added.length} ➖${listsDiff.removed.length} ✏️${listsDiff.changed.length}`);
  console.log(`  Strings ➕${stringsDiff.added.length} ➖${stringsDiff.removed.length}`);
  console.log(`  Steam   ${newCount} nota(s) nova(s) · ${allNews.length} recentes`);
  console.log("──────────────────────────────────────────");
  if (DRY) {
    console.log("[updater] (--dry) snapshots/relatório NÃO gravados.");
  } else {
    console.log(`[updater] 📄 relatório: ${reportPath}`);
    console.log(`[updater] revise o relatório e o \`git diff web/data/njs-snapshot\`, depois commit para avançar o baseline.`);
  }
}

main().catch((e) => {
  console.error("[updater] ERRO:", e);
  process.exit(1);
});
