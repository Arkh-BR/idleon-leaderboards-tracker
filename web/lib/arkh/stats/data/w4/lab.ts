// ===== LAB DATA =====
// 1:1 port of corgan-source/js/stats/data/w4/lab.js.
import {
  LabMainBonus,
  NinjaInfo,
  JewelDesc,
} from "../game/customlists.js";

const _lmb = LabMainBonus as any[][];
const _ni = NinjaInfo as any[][];
const _jd = JewelDesc as any[][];

export const LAB_BONUS_BASE: Array<[number, number, number, number, number, string]> =
  _lmb.map((b: any[]) => [
    Number(b[1]),
    Number(b[2]),
    Number(b[3]),
    Number(b[4]),
    Number(b[5]),
    b[6] as string,
  ]);

export const LAB_BONUS_DYNAMIC: Array<
  [number, number, number, number, number, string, number]
> = [25, 26, 27, 28].map((ni, k) => {
  const b = _ni[ni];
  return [
    Number(b[1]),
    Number(b[2]),
    Number(b[3]),
    Number(b[4]),
    Number(b[5]),
    b[6] as string,
    8 + k,
  ];
});

export const JEWEL_DESC: Array<[number, number, number, string]> = _jd.map(
  (j: any[]) => [Number(j[0]), Number(j[1]), Number(j[12]), j[11] as string]
);
