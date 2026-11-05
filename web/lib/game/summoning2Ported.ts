// Split from Summoning2 so Summoning can read it without the Summoning <-> Summoning2 import cycle deciding the evaluation order.
import { range, type Ported } from "./ported";

/** What this module covers (lib/game/ported.ts). */
export const PORTED: Ported = {
  MeritocBonusz: true,
  MeritocCanVote: true,
  MeritocBonuszMulti: true,
  VotingBonusz: range(0, 40), // 40 is past the vote categories the game lists
  VotingBonuszMulti: true,
  OwlMegafeather: true,
  OwlBonuses: range(-1, 6),
  BonusMultiCook: true,
};
