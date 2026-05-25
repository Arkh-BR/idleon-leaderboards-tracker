// ===== REGISTRY — Catalog of all systems for the drop-rate descriptor =====
// Maps the `system` field of each source in `defs/drop-rate.ts` to its
// resolver. Used by tree-builder.buildTree().

import type { CorganNode } from "../node";

import { talent } from "./systems/common/talent";
import { stamp } from "./systems/w1/stamp";
import { alchemy, sigil } from "./systems/w2/alchemy";
import { prayer } from "./systems/w3/prayer";
import { shrine } from "./systems/w3/construction";
import { arcade } from "./systems/w2/arcade";
import { voting } from "./systems/w2/voting";
import { card, cardSet, cardSingle } from "./systems/common/cards";
import { guild } from "./systems/common/guild";
import { starSign } from "./systems/common/starSign";
import { postOffice } from "./systems/w2/postOffice";
import { etcBonus } from "./systems/common/etcBonus";
import { shiny } from "./systems/w4/breeding";
import { companion, compMulti } from "./systems/common/companions";
import { winBonus } from "./systems/w6/summoning";
import { tome } from "./systems/w4/tome";
import { grid, chip } from "./systems/w4/lab";
import { dream, cloudBonusSys } from "./systems/w3/equinox";
import { goldenFood } from "./systems/common/goldenFood";
import { achievement } from "./systems/common/achievement";
import { owl } from "./systems/w1/owl";
import { grimoire } from "./systems/mc/grimoire";
import { vault } from "./systems/common/vault";
import { farm } from "./systems/w6/farming";
import { holes } from "./systems/w5/hole";
import { emperor } from "./systems/w6/emperor";
import { setBonus } from "./systems/w3/setBonus";
import { friend } from "./systems/common/friend";
import { legendPTS } from "./systems/w7/legend";
import { spelunkShop } from "./systems/w7/spelunking";
import { bundle } from "./systems/common/bundle";
import { ola } from "./systems/common/ola";
import { arcaneMap } from "./systems/mc/tesseract";
import { sushiRoG } from "./systems/w7/sushi";
import { minehead } from "./systems/w7/minehead";
import { pristine } from "./systems/w5/pristine";
import { glimbo, workshop, eventShop } from "./systems/common/wrappers";
import { lukScaling } from "./systems/common/stats";

// Loose ctx type — each system narrows what it actually reads
export type SystemCtx = {
  saveData: any;
  charIdx: number;
  activeCharIdx?: number;
  mapBon?: any[];
  mapIdx?: number;
  resolve?: (descId: string) => unknown;
};

export type SystemResolver = {
  resolve(id: any, ctx: SystemCtx, args?: unknown): CorganNode;
};

const _systems: Record<string, SystemResolver> = {
  talent: talent as unknown as SystemResolver,
  stamp: stamp as unknown as SystemResolver,
  alchemy: alchemy as unknown as SystemResolver,
  sigil: sigil as unknown as SystemResolver,
  prayer: prayer as unknown as SystemResolver,
  shrine: shrine as unknown as SystemResolver,
  arcade: arcade as unknown as SystemResolver,
  voting: voting as unknown as SystemResolver,
  card: card as unknown as SystemResolver,
  cardSet: cardSet as unknown as SystemResolver,
  cardSingle: cardSingle as unknown as SystemResolver,
  guild: guild as unknown as SystemResolver,
  starSign: starSign as unknown as SystemResolver,
  postOffice: postOffice as unknown as SystemResolver,
  etcBonus: etcBonus as unknown as SystemResolver,
  shiny: shiny as unknown as SystemResolver,
  companion: companion as unknown as SystemResolver,
  compMulti: compMulti as unknown as SystemResolver,
  winBonus: winBonus as unknown as SystemResolver,
  tome: tome as unknown as SystemResolver,
  grid: grid as unknown as SystemResolver,
  chip: chip as unknown as SystemResolver,
  dream: dream as unknown as SystemResolver,
  cloudBonus: cloudBonusSys as unknown as SystemResolver,
  goldenFood: goldenFood as unknown as SystemResolver,
  achievement: achievement as unknown as SystemResolver,
  owl: owl as unknown as SystemResolver,
  grimoire: grimoire as unknown as SystemResolver,
  vault: vault as unknown as SystemResolver,
  farm: farm as unknown as SystemResolver,
  holes: holes as unknown as SystemResolver,
  emperor: emperor as unknown as SystemResolver,
  setBonus: setBonus as unknown as SystemResolver,
  friend: friend as unknown as SystemResolver,
  legendPTS: legendPTS as unknown as SystemResolver,
  spelunkShop: spelunkShop as unknown as SystemResolver,
  bundle: bundle as unknown as SystemResolver,
  ola: ola as unknown as SystemResolver,
  arcaneMap: arcaneMap as unknown as SystemResolver,
  sushiRoG: sushiRoG as unknown as SystemResolver,
  minehead: minehead as unknown as SystemResolver,
  pristine: pristine as unknown as SystemResolver,
  glimbo: glimbo as unknown as SystemResolver,
  workshop: workshop as unknown as SystemResolver,
  eventShop: eventShop as unknown as SystemResolver,
  lukScaling: lukScaling as unknown as SystemResolver,
};

export function getSystem(name: string): SystemResolver | null {
  return _systems[name] || null;
}

export function getCatalog(): Record<string, SystemResolver> {
  return _systems;
}
