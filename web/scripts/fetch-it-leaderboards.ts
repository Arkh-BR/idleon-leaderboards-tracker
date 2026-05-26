// One-shot fetcher: hits IT's public leaderboard endpoint for every
// category that contains a board mappable to a DR source, then writes
// a normalized snapshot to web/data/it-leaderboard-top.json.
//
// Output shape: { fetchedAt, boards: { [apiKey]: { label, top: [{name,score,rank}, ...]}} }

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const API_BASE = "https://profiles.idleontoolbox.workers.dev/api/leaderboards";

// Only fetch categories that actually contain DR-mappable boards. Keeps
// the request count low and finishes in seconds.
const CATEGORIES = ["character", "general", "misc"] as const;

type TopEntry = { mainChar?: string; rank?: number; [k: string]: unknown };

function valueKeyOf(entry: TopEntry): string | null {
  for (const k of Object.keys(entry)) {
    if (k !== "mainChar" && k !== "rank") return k;
  }
  return null;
}

async function fetchCategoryTop(
  cat: string
): Promise<Record<string, TopEntry[]>> {
  const url = `${API_BASE}?leaderboard=${encodeURIComponent(cat)}`;
  const r = await fetch(url, {
    headers: {
      Referer: "https://idleontoolbox.com/",
      "User-Agent":
        "Mozilla/5.0 (compatible; IdleonDR-Research/1.0)",
    },
  });
  if (!r.ok) throw new Error(`${cat}: HTTP ${r.status}`);
  const data: any = await r.json();
  return data?.[cat]?.public ?? {};
}

(async () => {
  const out: Record<
    string,
    { label: string; top: { name: string; score: number; rank: number }[] }
  > = {};

  for (const cat of CATEGORIES) {
    process.stderr.write(`Fetching ${cat}…\n`);
    try {
      const top = await fetchCategoryTop(cat);
      for (const [apiKey, list] of Object.entries(top)) {
        const top10 = (list || []).slice(0, 10).map((e, i) => {
          const vk = valueKeyOf(e);
          const score = vk ? Number(e[vk]) : 0;
          return {
            name: String(e.mainChar || ""),
            score: Number.isFinite(score) ? score : 0,
            rank: typeof e.rank === "number" ? e.rank : i + 1,
          };
        });
        out[apiKey] = { label: apiKey, top: top10 };
      }
    } catch (e) {
      process.stderr.write(
        `  ! ${cat} failed: ${e instanceof Error ? e.message : String(e)}\n`
      );
    }
  }

  const repoRoot = resolve(__dirname, "..", "..");
  const outPath = resolve(repoRoot, "web/data/it-leaderboard-top.json");
  mkdirSync(dirname(outPath), { recursive: true });
  const payload = { fetchedAt: new Date().toISOString(), boards: out };
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(
    `✓ Wrote ${outPath}  (${Object.keys(out).length} boards, top-10 each)`
  );

  // Quick summary of the boards we care about for DR seeding
  const targets = [
    "dropRate",
    "sbPlunderousKills",
    "totalTomePoints",
    "glimboTotalTrades",
    "endlessSummoningWins",
    "mineheadOpponentsDefeated",
    "totalShinyLevels",
    "dkOrbKills",
    "highestCropOg",
    "totalCards",
  ];
  console.log("\nDR-relevant top-1 scores:");
  for (const t of targets) {
    const b = out[t];
    if (b && b.top[0]) {
      console.log(
        `  ${t.padEnd(28)} ${b.top[0].name.padEnd(18)} ${b.top[0].score}`
      );
    } else {
      console.log(`  ${t.padEnd(28)} (not in response)`);
    }
  }
})();
