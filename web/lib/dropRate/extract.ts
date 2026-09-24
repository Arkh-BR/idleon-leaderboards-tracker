// Extract Drop Rate snapshot from a raw IT "Copy for Support" save envelope.
// Reads pre-computed values from `extraData` (final DR + correlated stats)
// and pulls per-character stats from `data.PVStatList_N` ([STR, AGI, WIS, LUK, level]).
//
// Phase 1 (MVP): no IT pipeline port — we only surface what the envelope
// already computed. The full additive/multiplicative breakdown is Phase 2.

const STAT_INDEX = { strength: 0, agility: 1, wisdom: 2, luck: 3, level: 4 } as const;

export type CharSummary = {
  charIndex: number;
  charName: string;
  strength: number;
  agility: number;
  wisdom: number;
  luck: number;
  level: number;
};

export type DropRateSnapshot = {
  // When the snapshot was captured (Date.now() at save time)
  capturedAt: number;
  // When the save was last updated by the game (raw.lastUpdated)
  saveUpdatedAt: number | null;
  // Char selected by the user for this snapshot
  charIndex: number;
  charName: string;
  // Per-char stats (luck is the input to the non-linear DR curve)
  strength: number;
  agility: number;
  wisdom: number;
  luck: number;
  level: number;
  // Account-wide values from extraData (the "highest of any char" snapshots
  // IT computes during its envelope export — not per-character).
  accountDropRate: number | null;
  accountCashMulti: number | null;
  accountAccuracy: number | null;
  accountDefence: number | null;
  accountHp: number | null;
  accountMp: number | null;
  accountSlab: number | null;
  accountCurrentWorld: number | null;
  accountAgeDays: number | null;
};

// Shape just enough to keep TS honest; the real save has hundreds of keys.
type RawSave = {
  charNames?: unknown;
  accountCreateTime?: unknown;
  lastUpdated?: unknown;
  data?: Record<string, unknown>;
  extraData?: Record<string, unknown>;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parseSave(jsonText: string): RawSave {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Parsed JSON is not an object");
  }
  return parsed as RawSave;
}

export function listCharacters(save: RawSave): CharSummary[] {
  const names = Array.isArray(save.charNames) ? (save.charNames as string[]) : [];
  const data = save.data ?? {};
  const out: CharSummary[] = [];
  for (let i = 0; i < names.length; i++) {
    const stats = data[`PVStatList_${i}`];
    if (!Array.isArray(stats)) continue;
    out.push({
      charIndex: i,
      charName: String(names[i] ?? `Char ${i}`),
      strength: num(stats[STAT_INDEX.strength]) ?? 0,
      agility: num(stats[STAT_INDEX.agility]) ?? 0,
      wisdom: num(stats[STAT_INDEX.wisdom]) ?? 0,
      luck: num(stats[STAT_INDEX.luck]) ?? 0,
      level: num(stats[STAT_INDEX.level]) ?? 0,
    });
  }
  return out;
}

// A save older than this isn't "the game is open right now" — no point
// guessing who's active from a stale snapshot.
const ONLINE_STALE_MS = 10 * 60 * 1000;
// How close the leading character's last-activity timestamp must sit to
// lastUpdated to trust it as "the one currently being played."
const ONLINE_MATCH_MS = 5 * 60 * 1000;

// Index (into charNames) of the character that is online right now, or null
// if nobody is. data.PTimeAway_<ci> is the character's last-activity
// timestamp in thousands of seconds (×1e6 = Unix ms, matching
// save.lastUpdated's scale); the active character's value is refreshed
// continuously while the others go stale. Rule verified against two real
// saves: the active char's PTimeAway×1000 landed within seconds of
// lastUpdated, the others sat ~11.7h earlier.
export function onlineCharIndex(save: RawSave, now: number = Date.now()): number | null {
  const lastUpdated = num(save.lastUpdated);
  if (lastUpdated === null || now - lastUpdated > ONLINE_STALE_MS) return null;

  const names = Array.isArray(save.charNames) ? (save.charNames as unknown[]) : [];
  const data = save.data ?? {};
  let bestIdx: number | null = null;
  let bestAway = -Infinity;
  for (let i = 0; i < names.length; i++) {
    const away = num(data[`PTimeAway_${i}`]);
    if (away === null || away <= bestAway) continue;
    bestAway = away;
    bestIdx = i;
  }
  if (bestIdx === null) return null;

  const activityMs = bestAway * 1_000_000;
  return Math.abs(activityMs - lastUpdated) <= ONLINE_MATCH_MS ? bestIdx : null;
}

// The character a calculator should default to on a fresh load: whoever's
// online now (if still a listed character), else the first character.
export function defaultCharIndex(save: RawSave, list: CharSummary[], now: number = Date.now()): number {
  const online = onlineCharIndex(save, now);
  if (online !== null && list.some((c) => c.charIndex === online)) return online;
  return list[0].charIndex;
}

export function buildSnapshot(save: RawSave, charIndex: number): DropRateSnapshot {
  const chars = listCharacters(save);
  const ch = chars.find((c) => c.charIndex === charIndex);
  if (!ch) {
    throw new Error(`Character index ${charIndex} not present in save`);
  }
  const ex = save.extraData ?? {};
  return {
    capturedAt: Date.now(),
    saveUpdatedAt: num(save.lastUpdated),
    charIndex: ch.charIndex,
    charName: ch.charName,
    strength: ch.strength,
    agility: ch.agility,
    wisdom: ch.wisdom,
    luck: ch.luck,
    level: ch.level,
    accountDropRate: num(ex.dropRate),
    accountCashMulti: num(ex.cashMulti),
    accountAccuracy: num(ex.accuracy),
    accountDefence: num(ex.defence),
    accountHp: num(ex.hp),
    accountMp: num(ex.mp),
    accountSlab: num(ex.slab),
    accountCurrentWorld: num(ex.currentWorld),
    accountAgeDays: num(ex.accountAge),
  };
}

// Re-implementation of the luck → DR multiplier curve from N.js
// (mirrors getDropRate() in IT parsers/character.ts:2226-2232).
// Useful for Phase 1 even without the full pipeline, because it tells us
// what fraction of `accountDropRate` comes from luck vs everything else.
export function luckDropRateContribution(luck: number): number {
  if (!Number.isFinite(luck) || luck < 0) return 0;
  let luckMulti: number;
  if (luck < 1e3) {
    luckMulti = (Math.pow(luck + 1, 0.37) - 1) / 40;
  } else {
    luckMulti = ((luck - 1e3) / (luck + 2500)) * 0.5 + 0.297;
  }
  return 1.4 * luckMulti;
}
