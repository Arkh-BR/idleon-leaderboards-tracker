// ===== ARTIFACT FIND SYSTEM =====
// One id per term of N.js Sailing("BoatArtiMulti", b) with b = 0. Each returns
// what the formula puts inside its group; defs/artifact-find.ts owns the group
// shapes (and the factors' own max(1, ·) wrappers). Existing helpers are
// reused as-is; the terms the engine never ported live in ./terms.ts and
// w5/sailing.ts.

import { node, renamed, type ArkhNode } from "../../../node";
import type { SystemCtx } from "../../registry";
import { label } from "../../entity-names";
import { eventShopOwned, superBitType } from "../../../game-helpers";
import { ARTI_VOTE_NAME } from "../../defs/artifact-find";
import { computeArtifactBonus, captBonusCalc, captainsOfType6, daveyJonesBonus } from "../w5/sailing";
import { fractalIslandBonus, killroyBonus0, nightmarinerBon0, holesBUpg55, loreEpiBon } from "./terms";
import { stickerBonusSlot } from "../exp/sticker";
import { arrCount } from "../exp/exp";
import { votingMulti } from "../coin/coin";
import { votingBonusz } from "../w2/voting";
import { starSignBonusReal } from "../common/starSign";
import { shiny } from "../w4/breeding";
import { getBribeBonus } from "../w3/bribe";
import { arcadeBonus } from "../w2/arcade";
import { gridBonusValue, mainframeBonus } from "../w4/lab";
import { vaultUpgBonus } from "../common/vault";
import { companions } from "../common/companions";
import { computeButtonBonus } from "../w7/button";
import { computeVialByKey } from "../w2/alchemy";
import { sushiRoG } from "../w7/sushi";
import { computeWinBonus } from "../w6/summoning";
import { jellyRoG } from "../w7/jelly";
import { pristine } from "../w5/pristine";
import { computeMonumentROGbonus, monumentBonusLabel } from "../w5/hole";
import { computeExoticBonus } from "../w6/farming";
import { computePaletteBonus } from "../w7/spelunking";

/** Skill Info shows Sailing for boat 0, so the whole stat is Sailing("BoatArtiMulti", 0). */
export const SKILL_INFO_BOAT = 0;

type Tree = { val: number; children: ArkhNode[] | null };
const add = (name: string, r: Tree, note?: string): ArkhNode => node(name, r.val, r.children, { fmt: "+", note });
const plus = (name: string, v: number, kids?: ArkhNode[], note?: string): ArkhNode => node(name, v, kids, { fmt: "+", note });
const factor = (name: string, v: number, kids?: ArkhNode[], note?: string): ArkhNode => node(name, v, kids, { fmt: "x", note });
const raw = (name: string, v: number): ArkhNode => node(name, v, null, { fmt: "raw" });

// @njs BoatArtiMulti
function resolveArtifact(id: string, ctx: SystemCtx): ArkhNode {
  const s = ctx.saveData;
  const ci = ctx.charIdx;
  const sctx = { saveData: s, charIdx: ci } as any;

  switch (id) {
    // ── A: additive pool ────────────────────────────────────────────────
    // Sailing("ArtifactBonus", 3): base × tier × the character's Sailing level.
    case "artifact3":
      return plus("Fauxory Tusk (Artifact 3)", computeArtifactBonus(3, ci, sctx), undefined, "+ % per Sailing level × artifact tier");
    // CaptBonusCalc(3, Boats[b][0]); -1 (or no boat) = no captain.
    case "captain": {
      const capt = Number((s.boatsData as any[])?.[SKILL_INFO_BOAT]?.[0] ?? -1);
      return plus("Boat Captain (Artifact Find Chance)", captBonusCalc(3, capt, s), [raw("Captain index", capt)], `Captain trait type 3 of boat ${SKILL_INFO_BOAT} (the boat Skill Info shows)`);
    }
    case "shiny21":
      return shiny.resolve(21, sctx);
    // 20 × FractalIslandBonus(3).
    case "fractal3": {
      const f = fractalIslandBonus(3, s);
      return plus("Sailing Artifact Chance (Fractal Island 3)", 20 * f, [raw("Unlocked", f)], "×20 = +20% (the 1.20x milestone); unlocks at 2,500 h (OLA[184])");
    }
    case "bribe34":
      return add("Artifact Pilfering (Bribe 34)", getBribeBonus("34", s), "+20% artifact find chance");
    // 25 × min(30, NONdummies[60]) — but N.js fills NONdummies[60] only inside
    // `if (200 == CurrentMap)`, so the Skill Info reads 0 for it until the player
    // enters the W5 town in that session. The tracker follows the Skill Info
    // outside the town (user decision, in-game readings of 2026-11-01): the term
    // stays in the tree for the captain count but contributes 0.
    case "captains6": {
      const n = captainsOfType6(s);
      return node("Captains of type 6 (not counted)", 0, [raw("Type-6 captains", n)], {
        fmt: "+",
        note: "Skill Info counts it (+25 each, up to 30) only after you enter the W5 town (map 200) in that session — not counted here",
      });
    }
    case "arcade32":
    case "arcade66": {
      const n = Number(id.slice(6));
      return add(label("Arcade", n), arcadeBonus(n, s));
    }
    case "bUpg55":
      return plus("Tune of Artifaction (Cavern Upgrade 55)", holesBUpg55(s), undefined, "+10% per power of 10 Natural Notes");
    // Menagerie unlock 22 moves Sticker 2 from this slot to M2's, never both.
    case "sticker2add":
      return plus("Chocotastic Muffin Sticker (Sticker 2)", stickerBonusSlot(2, 99, s), undefined, "Additive slot (while Menagerie unlock 22 is locked)");
    case "grid109":
      return plus("Transcendent Artifacts (Research Grid 109)", gridBonusValue(109, s));
    case "vault63":
      return plus("Artifact Find Chance (Vault 63)", vaultUpgBonus(63, s));

    // ── M1–M23: factors ─────────────────────────────────────────────────
    // StarSigns["61"] (Artifosho): the one term that depends on the character.
    case "starSign61":
      return add(label("Star Sign", 61), starSignBonusReal("61", ci, s));
    case "sticker2mult":
      return plus("Chocotastic Muffin Sticker (Sticker 2)", stickerBonusSlot(2, 100, s), undefined, "Multiplier slot (once Menagerie unlock 22 is bought)");
    case "nightmariner":
      return factor("Nightmariner (Menagerie)", nightmarinerBon0(s));
    // min(2, 1 + 2·Companions(154)) + CompLV2(154).
    case "comp154": {
      const c = companions(154, s);
      const lv2 = s.companionLv2Ids?.has(154) ? 1 : 0;
      return factor(label("Companion", 154), Math.min(2, 1 + 2 * c) + lv2, [raw("Companion 154", c), raw("Stage 2", lv2)]);
    }
    case "killroy":
      return factor("Artifact Find Chance (Killroy Skull Shop 11)", killroyBonus0(s), undefined, "1 + OLA[228] / (300 + OLA[228])");
    case "button3":
      return plus("Artifact Odds (Minehead Button 3)", computeButtonBonus(3, s), undefined, "Button slot 3");
    case "grid106":
      return plus("The Maw (Research Grid 106)", gridBonusValue(106, s));
    case "vialTurtle":
      return add("Turtle Tisane (Vial 74)", computeVialByKey("6turtle", s), "Vial effect key 6turtle");
    // 1.5 ^ PurpleChestSlugsOwned, = round(EventShopOwned(48)).
    case "slugs": {
      const owned = Math.round(eventShopOwned(48, s.cachedEventShopStr || ""));
      return factor("Noble Sluggo (Event Shop 48)", Math.pow(1.5, owned), [raw("Owned", owned)], "1.5 ^ owned (Purple Chest Slugs)");
    }
    case "sushi7":
      return sushiRoG.resolve(7, ctx as any);
    case "win3":
      return plus("Artifact Find (Winner Bonus 3)", computeWinBonus(3, null, s), undefined, "Summoning winner bonus 3");
    case "jelly19":
      return jellyRoG.resolve(19, sctx);
    case "davey":
      return factor("Davey Jones", daveyJonesBonus(SKILL_INFO_BOAT, s), undefined, `Boat ${SKILL_INFO_BOAT} (the boat Skill Info shows)`);
    case "mainframe14":
      return plus("Artifact Attraction (Mainframe 14)", mainframeBonus(14, s), undefined, "Lab main bonus 14 (Emporium unlock)");
    case "loreEpi3":
      return plus("Artifact Find (Lore Episode 3)", loreEpiBon(3, s), undefined, "Spelunking lore bonus 3");
    case "pristine2":
      return renamed(pristine.resolve(2, sctx), "Glowing Veil (Pristine Charm 2)", "x Artifact Find Chance");
    // VotingBonusz(20) = base × VotingBonuszMulti; only the week's winning vote counts.
    case "vote20": {
      const multi = votingMulti(ctx);
      return plus(ARTI_VOTE_NAME, votingBonusz(20, multi, s), [factor("Voting multi", multi)], "Only counts the week vote 20 wins");
    }
    case "comp43":
      return node(label("Companion", 43), companions(43, s), null, { fmt: "raw" });
    case "comp56":
      return factor(label("Companion", 56), companions(56, s) / 5, undefined, "÷ 5");
    case "monument1_2":
      return plus(monumentBonusLabel(1, 2), computeMonumentROGbonus(1, 2, s));
    case "exotic45":
      return plus("5 Leaf Clover (Exotic Market 45)", computeExoticBonus(45, s), undefined, "x Artifact Find Chance");
    case "palette5":
      return plus("Bright Cyan (Palette 5)", computePaletteBonus(5, s), undefined, "x Artifact Find chance");
    // 1.02 ^ Spelunk[6].length × SuperBitType(26); the group floors it at 1.
    case "spelunkBit26": {
      const n = arrCount((s.spelunkData as any)?.[6]);
      const bit = superBitType(26, (s.gamingData as any)?.[12]);
      return factor("Artifacto Discoveries (Super Bit 26)", Math.pow(1.02, n) * bit, [raw("Spelunk[6].length", n), raw("Super Bit 26", bit)], "1.02 ^ Spelunk discoveries × Super Bit 26");
    }
    default:
      throw new Error(`artifact: unknown source "${id}"`);
  }
}

export const artifact = { resolve: resolveArtifact };
