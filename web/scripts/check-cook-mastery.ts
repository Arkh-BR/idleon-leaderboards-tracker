// Validação do otimizador de Cooking Mastery contra um save real.
// Uso: npx tsx scripts/check-cook-mastery.ts ["C:\\...\\save.json"]
import { readFileSync } from "node:fs";
import { loadSaveData } from "../lib/arkh/save/loader";
import { saveData } from "../lib/arkh/state";
import {
  readMasteryInputs,
  masteryExpReq,
} from "../lib/arkh/stats/systems/common/cookingMastery";
import { optimize } from "../lib/cookingMastery/optimize";

const g = globalThis as any;
if (!g.window) g.window = g;

const path =
  process.argv[2] ||
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\save 25-21-16.json";
console.log(`Save: ${path}\n`);

const raw = JSON.parse(readFileSync(path, "utf8"));
loadSaveData(raw);

const inp = readMasteryInputs(saveData);

console.log("=== Cooking Mastery — estado ===");
console.log(
  `Rank: ${inp.rank}   EXP: ${inp.exp.toExponential(3)} / ${masteryExpReq(inp.rank).toExponential(3)}`,
);
console.log(`Ladles  (CookMaster[1][3])    : ${inp.ladles}`);
console.log(`Cooking LV total (Σ Lv0[10])  : ${inp.totalCookingLv}`);
console.log(`Divorce Cake LV (Meals[0][73]): ${inp.divorceCakeLv}`);
console.log(`Ribbon Ranks tot (Σ Rib[28+]) : ${inp.totalRibbonRanks}`);
console.log(`Companion 87 (rift1)          : ${inp.comp87}`);
console.log(`Purple PTS (CookMaster[2])    : [${inp.purple.join(", ")}]`);
console.log(`externalMulti                 : ${inp.externalMulti}`);

if (inp.rank === 0 && inp.ladles === 0 && inp.purple.every((p) => p === 0)) {
  console.log(
    "\n⚠️  Save parece PRÉ-Cooking-Mastery (tudo zero). Forneça um save pós-patch para validar de verdade.",
  );
}

// argv[3] = Exp/h in-game (ex: 56.6e6) para calibrar o multiplicador externo
const ingameExpRate = process.argv[3] ? Number(process.argv[3]) : undefined;
const r = optimize(inp, { calibrateExpRate: ingameExpRate });

console.log("\n=== Pools de pontos ===");
console.log(
  `Purple total ${r.pools.purpleTotal} · gasto ${r.pools.purpleSpent} · disponível ${r.pools.purpleAvailable}`,
);
console.log(`Yellow total ${r.pools.yellowTotal}`);

console.log("\n=== Exp/h ===");
console.log(
  `externalMulti: ${r.externalMulti.toFixed(3)} ${r.calibrated ? "(calibrado da Exp/h in-game)" : "(calculado dos 6 fatores externos)"}`,
);
console.log(
  `Atual : ${r.current.expRate.toExponential(4)} /h   (core ${r.current.expRateCore.toFixed(3)})`,
);
console.log(
  `Ótima : ${r.optimal.expRate.toExponential(4)} /h   (core ${r.optimal.expRateCore.toFixed(3)})`,
);
console.log(`Ganho com realocação total: +${r.gainPct.toFixed(1)}%`);

console.log("\n=== ROI por upgrade (ordenado por ganho marginal atual) ===");
console.log(
  "upgrade".padEnd(34) + "req".padStart(4) + "base×coef".padStart(14) + "atual→ótimo".padStart(13) + "Δ/pt".padStart(9),
);
for (const row of r.roi) {
  console.log(
    row.name.padEnd(34) +
      String(row.rankReq).padStart(4) +
      `${row.base.toFixed(1)}×${row.coef}`.padStart(14) +
      `${row.currentPts}→${row.optimalPts}`.padStart(13) +
      (row.unlocked ? `+${row.marginalGainPct.toFixed(2)}%` : "🔒").padStart(9),
  );
}
