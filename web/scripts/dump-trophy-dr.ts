import { TROPHY_DR, TROPHY_NAMES, NAMETAG_DR } from "../lib/corgan/stats/data/w7/gallery";
console.log("TROPHY_DR keys:", Object.keys(TROPHY_DR).length);
for (const k of Object.keys(TROPHY_DR).sort((a,b)=>Number(a)-Number(b))) {
  console.log(" ", k, TROPHY_NAMES[Number(k)], JSON.stringify(TROPHY_DR[Number(k)]));
}
