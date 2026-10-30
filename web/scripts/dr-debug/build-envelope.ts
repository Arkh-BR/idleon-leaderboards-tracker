// Rebuild the site's SaveEnvelope (lib/gameAuth/envelope.ts) from a captured bundle.json and print
// the DR of one character/map — it must equal the site to the cent (see README.md §1).
// usage: npx tsx --tsconfig tsconfig.json scripts/dr-debug/build-envelope.ts <bundle.json> <envelope.json> <charIdx> <map>
import { readFileSync, writeFileSync } from "node:fs";
import { decodeFirestoreFields } from "@/lib/gameAuth/firebase";
import { computeTome } from "@/lib/tome/compute";
import { computeArkhDropRate } from "@/lib/arkh/computeDR";

const [bundlePath, outPath, ci = "0", map = "0"] = process.argv.slice(2);
const b = JSON.parse(readFileSync(bundlePath, "utf8"));
const doc = (t: string | null) => (t ? JSON.parse(t) : null);
const fs = (d: any) => (d ? { fields: decodeFirestoreFields(d.fields ?? {}), createTime: d.createTime, updateTime: d.updateTime } : null);
const parseJson = (v: unknown) => { if (typeof v !== "string") return v ?? null; try { return JSON.parse(v); } catch { return null; } };
const save = fs(doc(b.data))!;
const guild = doc(b.guild);
const usgu = doc(b.usgu);
const env: any = {
  data: save.fields,
  charNames: doc(b.uid),
  companion: doc(b.comp),
  guildData: { id: typeof usgu === "string" ? usgu : null, stats: parseJson((save.fields as any).Guild), members: Object.values(guild?.m ?? {}), points: guild?.p ?? null },
  serverVars: fs(doc(b.vars))?.fields ?? null,
  tournament: { user: null, match: fs(doc(b.tres))?.fields ?? null, global: fs(doc(b.tour))?.fields ?? null, leaderboard: [] },
  accountCreateTime: Math.floor(Date.parse(save.createTime) / 1000) * 1000,
  lastUpdated: Date.parse(save.updateTime),
};
// Same Tome stamp the site applies to a signed-in save (envelope.ts tomePoints).
env.extraData = { totalTomePoints: computeTome({ ...env, data: { ...env.data } }).totalPts };
writeFileSync(outPath, JSON.stringify(env));
const dr = computeArkhDropRate(env, Number(ci), Number(map)).total;
console.log(`saved ${save.updateTime} · tome ${env.extraData.totalTomePoints} · char ${ci} map ${map} → DR ${dr} (site shows ${Math.round(100 * dr) / 100})`);
