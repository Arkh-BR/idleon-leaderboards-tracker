// ===== TALENTS "FALTANDO P/ MAX" =====
// Account-wide scan that lists, per character, every regular (tab 1-5)
// talent whose invested level is still BELOW its Max Book Lv Cap — i.e.
// the talents the player can still push up by investing more points.
//
// Both talent presets are reported: each row carries the level invested in
// Preset 1 and Preset 2 against the same cap, and a talent makes the list
// when it's below cap in EITHER preset. The active preset's levels come
// from SL_{ci} (loaded into skillLvData); the other preset's from
// SLpre_{ci}, read straight off the raw envelope. There's only one
// SkillLevelsMAX (SM_{ci}) per char — no SMpre — so both presets share it.
//
// Lightweight by design: pure SL/SLpre/SM lookups, no per-talent tree
// resolve, so a 10-char account scans in O(chars × talents) lookups.
//
// Star talents (the "Special Talent" tabs) are pool-capped and have no Max
// Book Lv Cap, so they're skipped entirely.

import { makeCtx } from "@/lib/game/ctx";
import { charKey, opt } from "@/lib/game/state";
import { stateOf } from "@/lib/game/trackers/page";
import { maxBookLv as accountMaxBookLv } from "../dropRate/explain/talent";
import { entityName } from "./entityNames";
import { TALENT_TABS_BY_CLASS } from "./talentTabs.gen";
import { getCharClassKey, getCharClassLabel } from "./charClass";
import { getActivePresetIdx } from "./compute";
import { listCharacters } from "../dropRate/extract";
import type { GameState } from "@/lib/game/state";
import { isAccountWideTalent } from "./accountWideTalents";

export type ToMaxItem = {
  talentId: number;
  /** Friendly talent name (entityName, falling back to title-cased raw). */
  name: string;
  /** Cleaned lvlUpText ("+{_STR" → "+ STR") shown as the bonus subtitle. */
  bonusText: string;
  /** Tab the talent lives in (for context — e.g. "Death Bringer"). */
  tab: string;
  /** Max Book Lv Cap (shared by both presets). */
  cap: number;
  /** Points invested in Preset 1 / Preset 2. */
  investedP1: number;
  investedP2: number;
  accountWide: boolean;
};

export type ToMaxCharGroup = {
  charIdx: number;
  charName: string;
  classLabel: string;
  level: number;
  /** Which preset (0 = Preset 1, 1 = Preset 2) is active in-game for this
   *  char — surfaced so the UI can flag it. */
  activePreset: 0 | 1;
  /** Talents below cap in at least one preset, sorted by the larger of the
   *  two gaps (descending). May be empty when everything is at the cap. */
  items: ToMaxItem[];
  /** Total regular talents scanned for this char (for the "X / Y at cap"
   *  read-out). */
  totalScanned: number;
};

// Strip the game's formula-placeholder tokens out of lvlUpText so it reads as a
// plain bonus name. Mirrors the same helper in TalentsLevelPageClient.
function cleanLvlUpText(s: string): string {
  return s.replace(/[{}_]/g, " ").replace(/\s+/g, " ").trim();
}

// CONSTANT_CASE talent name → "Title Case" fallback when entityName has no
// mapping (e.g. "FIST_OF_RAGE" → "Fist Of Rage").
function prettifyName(raw: string): string {
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** The level saved for a talent under `key_ci` (SL, SM, SLpre); an absent map or entry reads as 0. */
function readLevel(state: GameState, key: string, ci: number, talentId: number): number {
  return Number(opt(state, charKey(key, ci), talentId)) || 0;
}

/**
 * Scan the whole account and return, per character, the regular talents
 * still below their Max Book Lv Cap in either preset.
 *
 * @param rawEnvelope The parsed "Copy for Support" save (same object the
 *   page already holds as `save`).
 */
export function computeTalentsToMax(rawEnvelope: any): ToMaxCharGroup[] {
  const state = stateOf(rawEnvelope);
  const maxBookLv = accountMaxBookLv(makeCtx(state, { player: 0, map: 0 }));
  const chars = listCharacters(rawEnvelope);

  const groups: ToMaxCharGroup[] = [];
  for (const ch of chars) {
    const ci = ch.charIndex;
    const classKey = getCharClassKey(rawEnvelope, ci);
    if (!classKey) continue;
    const cls = TALENT_TABS_BY_CLASS[classKey];
    if (!cls) continue;

    // SL_{ci} holds the ACTIVE preset's levels; SLpre_{ci} the other one.
    // Map both onto Preset 1 / Preset 2 by the active-preset index so the
    // labels line up with what the player sees in-game.
    const activePreset = getActivePresetIdx(rawEnvelope, ci);
    const keyP1 = activePreset === 0 ? "SL" : "SLpre";
    const keyP2 = activePreset === 1 ? "SL" : "SLpre";

    const items: ToMaxItem[] = [];
    const seen = new Set<number>();
    let totalScanned = 0;

    for (const tab of cls.tabs) {
      // Star talents are pool-capped — no Max Book Lv Cap to chase.
      if (tab.name.startsWith("Special Talent")) continue;
      const tabLabel = tab.name.replace(/_/g, " ");
      for (const t of tab.talents) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        totalScanned++;

        const investedP1 = readLevel(state, keyP1, ci, t.id);
        const investedP2 = readLevel(state, keyP2, ci, t.id);
        // SM holds the live in-game cap (incl. cap-booster raises for the
        // stat talents). When it's missing/zero the game hasn't written a
        // cap for this talent yet → fall back to the account-wide formula.
        const savedCap = readLevel(state, "SM", ci, t.id);
        const cap = savedCap > 0 ? savedCap : maxBookLv;
        // Keep it only if it's still below cap in at least one preset.
        if (investedP1 >= cap && investedP2 >= cap) continue;

        const friendly = entityName("talent", t.id) || prettifyName(t.name);
        items.push({
          talentId: t.id,
          name: friendly,
          bonusText: cleanLvlUpText(t.lvlUpText),
          tab: tabLabel,
          cap,
          investedP1,
          investedP2,
          accountWide: isAccountWideTalent(t.id),
        });
      }
    }

    // Sort by the larger of the two preset gaps (what's furthest from cap).
    items.sort(
      (a, b) =>
        Math.max(b.cap - b.investedP1, b.cap - b.investedP2) -
        Math.max(a.cap - a.investedP1, a.cap - a.investedP2)
    );
    groups.push({
      charIdx: ci,
      charName: ch.charName,
      classLabel: getCharClassLabel(rawEnvelope, ci) ?? "—",
      level: ch.level,
      activePreset,
      items,
      totalScanned,
    });
  }
  return groups;
}
