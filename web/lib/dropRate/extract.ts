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
