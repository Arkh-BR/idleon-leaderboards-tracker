# Talent Final-Bonus Wraps & Stat-Engine Port

Reference doc for the talent "final bonus" system on `/talents-level` and
`/drop-rate`. Written 2026-05-28. Branch: `drop-rate-max-values`.

This started as "are there account-wide talents we're missing?" and grew into
a full port of the in-game stat/damage/accuracy engines so that **every talent
shows its true final in-game bonus** on its headline row, with the inputs
drillable in the tree.

---

## 1. The core idea — "wraps"

For MOST talents, `formulaEval(formula, x1, x2, effective_lv)` — what
`talent.resolve()` returns — IS the final bonus. Eternal STR's "+792" means
literally +792 STR. No wrap needed.

Some talents are different: their formula result is only a **coefficient**
("+X% per power of 10 of <some counter>"). The real bonus needs an extra step
that combines the coefficient with a **counter** read from the save / a derived
stat. Without the wrap the headline shows the bare coefficient (e.g. `4.86`),
which is useless on its own.

A **wrap** applies the counter so the headline = final bonus, and exposes the
inputs as tree children:

```
Talent X = <final bonus>
├── Effective Level (Base + Bonus + Super)   ← formula input
├── Talent Value = formula(effective_lv)     ← the coefficient
└── <Counter>                                ← external/derived value
```

### Wrap shapes seen in N.js
- **log multiplier**: `final = 1 + talVal × log10(counter) / 100`   (fmt `x`)
- **log additive**:   `final = talVal × log10(counter)`             (fmt `+`)
- **log chance**:     `final = talVal × log10(counter) / 100`       (fmt `+`)
- **linear**:         `final = talVal × counter`                    (Cat 3a/3b)
- **custom**:         arbitrary fn (power, clamp, rational, …)      (Cat 4)

---

## 2. Key files

| File | Role |
|---|---|
| `lib/corgan/stats/data/common/talent-final-bonus-wraps.ts` | The wrap registry `TALENT_FINAL_BONUS_WRAPS`, `CounterSource` union, `readCounter`, `applyTalentWrap`. (Renamed from `external-context-multipliers.ts`.) |
| `lib/corgan/stats/data/common/account-wide-talents.ts` | `ACCOUNT_WIDE_TALENT_IDS` — talents whose bonus is cross-character (best owner-class char wins). |
| `lib/corgan/stats/data/common/talent-cap-boosters.ts` | `TALENT_CAP_BOOSTERS` — per-talent SkillLevelsMAX cap overrides (see §7). |
| `lib/corgan/stats/systems/common/stats.ts` | Ported stat engine — `computeTotalStat` + chain. |
| `lib/corgan/stats/systems/common/derived-stats.ts` | `computePlayerHPmax`, `computePlayerMPmax`, `computeSkillEfficiency`. |
| `lib/corgan/stats/systems/common/derived-damage.ts` | `computeMaxDamage`, `computeOverkillTier`, `computePlayerSpeed`, `computeAccuracy`. |
| `lib/corgan/stats/systems/common/calcTalent.ts` | `computeCalcTalent(id, charIdx, saveData)` → `CalcTalentMAP[id]`. |
| `lib/corgan/stats/systems/w6/upg-totals.ts` | Counter helpers (upgrade totals, inventory rollup, kill-tracker, atom, titans, onyx). |
| `lib/corgan/stats/systems/common/talent.ts` | `talent.resolve` — calls `applyTalentWrap` at the 3 emit sites (account-wide / star / standard). |

### Registry entry shape (`TalentWrapSpec`)
```ts
{
  counterLabel: string;
  counterSource: CounterSource;       // where readCounter pulls the counter
  counterNote: string;
  wrap: (talVal, counter) => number;  // required base/fallback
  wrapWithLv?:  (talVal, counter, effectiveLv) => number;   // for Lv-scaled caps (282)
  wrapWithSave?: (talVal, counter, saveData, charIdx) => number; // folds in a 2nd save term (inv-log + Atom)
  fmt: "x" | "+";
  noteForActive, inactiveVal, inactiveNote, extraBaseKids?
}
```
`applyTalentWrap` precedence: `wrapWithSave` > `wrapWithLv` > `wrap`.

### `CounterSource` kinds
`OLA` (optionsListData), `PetsStored`, `PlayerHPmax`, `PlayerMPmax`,
`SkillStats` (skill efficiency), `Lv0` (skill level), `TotalStat`
(STR/AGI/WIS/LUK), `GrimoireUpgTotal`, `ArcaneUpgTotal`, `CompassUpgTotal`,
`TotBreedzWWz`, `StatueOnyx`, `MinigameHiscore`, `CalcTalent` (CalcTalentMAP),
`TotalTitanKills`, `InvStorageOwned`, `PlayerSpeedBonus`.

---

## 3. Account-wide audit

Cross-checked `ACCOUNT_WIDE_TALENT_IDS` against every
`_customBlock_getbonus2(N, id, -1)` call in N.js.

- **+17 added** (account-wide, were missing): 51,52,53,54 (Eternal STR/AGI/WIS/LUK),
  57, 178, 204, 205, 327, 370, 373, 430, 505, 535, 585, 595, 597.
- **−1 removed**: 475 (Charge Syphon) — an *active* skill that steals worship
  charge, not a passive cross-char bonus.
- **Excluded with rationale** (look account-wide but aren't): 144 (The Family
  Guy — per-char even though N.js calls getbonus2 on it in the FB68 chain),
  149/374/539 (Symbols of Beyond — owner-char ATL only).

`talent.resolve` auto-detects account-wide ids and emits cross-char "max" mode
(best owner-class char), surfacing a **Reference Character** node *inside* Base
Level (the ref char only supplies the raw lv; Bonus/Super come from the active
char).

---

## 4. The four waves (~63 talents wrapped)

### Wave 1 — Cat 2 log-wrap (13)
| Talent | Counter | Shape |
|---|---|---|
| 178 King of the Remembered | OLA[138] | `1+tv·log10(c)/100` (x) |
| 208 Wraith Overlord | OLA[329] | x |
| 328 Archlord of the Pirates | OLA[139] Plunderous Kills | x |
| 433 Dustwalker | OLA[362] | x |
| 508 Wormhole Emperor | OLA[152] | x |
| 598 Tachyon Truth | OLA[394] | `tv·log10(c)/100` chance (+) |
| 638 Dungeonic Damage | OLA[71] | `tv·log10(c)` (+) |
| 649 Filthy Damage | OLA[161] | + |
| 653 Dummy Thicc Stats | OLA[172] | + |
| 365 Animalistic Ferocity | PetsStored[0][2] | + |
| 86 Meat Shank | PlayerHPmax | + |
| 446 Overclocked Energy | PlayerMPmax | + |
| 202 Famine O' Fish | SkillEfficiency("Fishing") | + |
| 655 Boss Battle Spillover (star) | OLA[189] Skulls | `perSkull·skulls` (+) |

### Wave 2 — Cat 3a linear × counter (24)
- **Lv0[n] / TotalStat / OLA**: 58 (OLA[158] floor/5), 103 (Lv0[1] mining),
  140 (Lv0[10] cooking), 141 (TotalStat STR /1000), 170 (Lv0[15] gaming),
  281 (Lv0[2] smithing), 320 (Lv0[13] sailing), 366 (TotalStat AGI /1000),
  500 (Lv0[14] divinity), 530 (Lv0[12] lab), 531 (TotalStat WIS /1000).
- **W6 system upg totals**: 200/201 (GrimoireUpgTotal /100), 425/426
  (CompassUpgTotal /100), 427 (TotBreedzWWz floor/25), 591 (ArcaneUpgTotal /100).
- **Misc counters**: 463 (MinigameHiscore[0] floor/25), 654 (StatueOnyx ×count),
  177 (Lv0[15] /100 — gaming-mult component omitted, Bits not DR),
  590 (ArcaneUpgTotal /100/100 — pow(1.04,ACzWepAtk) omitted).
- **Left Cat 1 (raw value already correct)**: 45 & 498 (active skills), 507
  (additive in N.js).

### Wave 3 — Cat 3b CalcTalentMAP (16)
`computeCalcTalent` keys (all confirmed vs N.js `_customBlock_TalentCalc`):
| Key | Computation |
|---|---|
| 31 | `min(Lv0[1..9])` lowest skill lv → wrap `×floor(MAP/5)` |
| 57 | `max(0, best(Lv0[7]+Lv0[9] over cls<6) − 100)` |
| 59 | `Σ Meals[0][*]` → wrap `pow(min(1.012,1+tv/100), MAP)` (5e53× faithful — Blood Marrow multiplicative cooking spd) |
| 110/146/209 | Apocalypse kill-trackers (see §6) |
| 125 | refinery sum gated by accuracy (see §6) |
| 305 | `count(Cards[1] items, excl Gem*/Cards*)` |
| 430 | `Σ Ninja[103][*]` → `×floor(MAP/10)` |
| 470 | `[PROXY]` count StampLv>0 (should be StampLevelMAX>0.5) |
| 485 | `count(CauldronInfo[4][*] > 3 vials)` |
| 595 | `Σ Summon[0][*]` → `1 + 0.01·tv·floor(MAP/100)` (x) |
| 616 | best Lv0[0] (Beginner) → `min(tv, floor(MAP/10))` clamp |
| 620 | best Lv0[0] (all chars) → clamp |
| 643 | overkill tier (see §6) |
| 644 | `Lv0[10]/10` cooking |
| 650 | `count(Cards[1] ∩ RANDOlist[82..86])` random-event rares |
| 656 | `count(DreamChallenge where WeeklyBoss["d_"+g]===-1)` dream clouds |

### Wave 4 — Cat 4 custom (10 wrapped, ~28 Cat 1)
| Talent | Wrap |
|---|---|
| 313 Reflective Eyesight | `pow(max(1,tv), 1+floor(Lv0[7]/10))` (x) |
| 434 Slayer Abominator | `pow(tv, TotalTitanKills=ΣCompass[1]==1)` (x) |
| 282 Yea I Already Know | `min(tv×(AGI/250), GTN(2,282) cap)` via wrapWithLv |
| 101/131/295/311/461/476 | `tv×(log10(InvStorageOwned)+Atom1)` via wrapWithSave |
| 290 Speedna | `tv×(min(1000,100×(speed−1))/15)` |
- **Cat 1 (skipped, raw value correct)**: 50,56,114,116,130,136,144,205,206,207,
  318,326,327,370,373,429,431,432,480,490,506,535,536,585,589,594,597,615.

---

## 5. Ported engines

All faithful ports of corgan-source defs/systems, reusing each other.

- **stats.ts**: `computeTotalStat` (STR/AGI/WIS/LUK) + `computeCardBonusByType`,
  `computeBoxReward`, `computeEquipBaseStat`, `computeGalleryBaseStat`,
  `computeObolBaseStat`, `computeFamBonusQTYs/QTY`, `computeStatueBonusGiven`,
  `computeMealBonus`, `computeWorkbenchStuff`. **Validated vs `PVStatList_N`
  within ~1%** (the gap is a stale save snapshot, not a bug — see §8).
- **derived-stats.ts**: `computePlayerHPmax`, `computePlayerMPmax`,
  `computeSkillEfficiency`.
- **derived-damage.ts** (port of damage.js ~994 lines): `computeMaxDamage`,
  `computeOverkillTier`, `computePlayerSpeed`, `computeAccuracy` (port of
  accuracy.js ~190 lines).
- **calcTalent.ts**: `computeCalcTalent` — CalcTalentMAP keys.
- **upg-totals.ts**: `grimoireUpgTotal`, `arcaneUpgTotal`, `compassUpgTotal`
  (note: Compass save is NESTED — sum `Compass[0][i]`), `totBreedzWWz`,
  `statueOnyxOwned`, `invStorageOwned`, `atomBonus1`, `totalTitanKills`,
  `apocalypseMapsOver`/`apocalypseMapsOverBest`.

---

## 6. The hard de-stubs (formerly returned 0)

| Talent(s) | System ported | Counter formula |
|---|---|---|
| 101/131/295/311/461/476 | inventory rollup | `invStorageOwned(item)` = Σ qty in all chars' `InventoryOrder_N/ItemQTY_N` + `ChestOrder/ChestQuantity` |
| 110/146/209 (Apocalypse) | rift kill-tracker | `killsDone(map g) = MapDetails[g][0][0] − KLA[charIdx][g][0]` (KLA goes negative on over-kill = lifetime kills); count maps ≥ 1e5/1e6/1e9; 110/146 capped by GTN(2,id) |
| 643 (Coins For Charon) | max-damage engine | overkill tier = log_okExp(maxDmg / monsterHP), 1..50; okExp = currentMap≥300 ? 5 : 2 |
| 290 (Speedna) | move speed | `min(1000, 100×(computePlayerSpeed−1))` |
| 125 (Precision Power) | accuracy engine | `Σ Refinery[3+g][1] (g=0..5)` IF `computeAccuracy ≥ 2.25 × MONSTERS[MapAFKtarget[currentMap]].Defence` else 0 |

**No stubs remain.** Only the Tal 470 `[PROXY]` survives (StampLv>0 vs
StampLevelMAX>0.5 — slightly undercounts owned-but-unleveled stamps, rare).
Some deep damage/accuracy sub-sources stub to 0 (runtime buffs, flurbo, roo,
divinity-minor, etc.) but they feed log/gate outputs so they don't move results.

---

## 7. Cap boosters (separate from wraps — SkillLevelsMAX)

`talent-cap-boosters.ts` overrides the per-talent cap (`SkillLevelsMAX[id]`)
for talents whose cap is raised by OTHER talents' bonuses. Verified 60/60
against the save's `SM_ci[id]` for active chars. Two flavors:
- **Stat talents** (10/11/12/23/75): `cap = 100 + Σ booster contributions`.
- **Bubble-capped** (79/86/87/266/267/446/447): `cap = max(100 + min(booster,
  bubbleLv), savedSM)` — `ratchet` honors the save's never-decreasing cap.

The `/talents-level` headline does `Max Effective LV = cap + bonus + super`,
`Current Effective LV = invested + bonus + super`.

---

## 8. Critical findings & gotchas

- **N.js is the source of truth — corgan-source drifts.** Two formulas were
  wrong in corgan-source: the **sigil Eclectic 5th tier** (`SigilDesc[12]`,
  used for sigil lvl ≥ 3.5 — our `sigils.ts` is correct, matches N.js) and the
  **golden-food scale in skill efficiency** (corgan used raw % `23004×`; N.js
  returns `1 + GfoodBonus/100` for the `*Eff` keys — fixed). Always verify
  against N.js (`https://www.legendsofidleon.com/ytGl5oc/N.js`). See memory
  `corgan-source-vs-njs-drift.md`.
- **PVStatList is a stale snapshot.** `computeTotalStat` lands ~1% above
  `PVStatList_N` because the player leveled sigils to Eclectic *after* the save
  wrote the snapshot. Not a bug.
- **Import cycle** `derived-damage → talent → talent-final-bonus-wraps →
  calcTalent → derived-damage` resolves safely: all cross-cycle uses are
  call-time inside hoisted function declarations; the damage path never resolves
  talent 643/125 (no recursion).
- **Two N.js wrap-detection traps** (both bit us): the `findDescendant`
  depth-first walk grabbed nested booster nodes — pull headline metrics from the
  target's **direct children** instead; and the offset ~7003000-7011000 block is
  the **tooltip renderer** (every talent appears there with `×getLOG(...)`) — it
  maps talent→counter but is NOT the real bonus emission. Real emission is
  elsewhere.
- **DR invariant**: DR final = **43093.438x** (zArkhe, Town, no AC) unchanged
  across all ~24 commits. `60/60` cap matches. `tsc` clean every commit.

---

## 9. Validation scripts (`web/scripts/`)

`check-talent-caps.ts` (cap vs SM_ci), `check-total-stat.ts` (TotalStat vs
PVStatList), `check-cat2-wraps.ts` (all registry wraps), `check-cat3b-calctalent.ts`,
`check-cat4-wraps.ts`, `check-overkill-643.ts`, `check-talent125.ts`,
`check-talent-summary.ts` (Max ≥ Current), `check-account-wide-new.ts`.

Run pattern: `globalThis.window = globalThis; loadSaveData(JSON of "../save
25-21-16.json"); talent.resolve(id, {saveData, charIdx, activeCharIdx})`.

Regenerate artifacts after lib changes:
```
npx tsx scripts/build-dr-bundle.ts     # data/dr-compute-bundle.js
npx tsx scripts/gen-source-catalog.ts  # data/dr-source-catalog.json + public/dr-max-values.html
```

---

## 10. Commit log (branch `drop-rate-max-values`, this session)

```
0959a65 de-stub accuracy — Tal 125; no stubs left
3d7fa21 de-stub move speed — Tal 290
b02aa16 de-stub overkill 643 — port max-damage engine
ecb344c de-stub kill-trackers — Apocalypse 110/146/209
6ac470f de-stub inventory — 6 inventory-log talents
241287a Onda 4 — Cat 4 custom (10 wrapped, ~28 Cat 1)
f71874b Onda 3 — 16 Cat 3b CalcTalentMAP + port calcTalent
6d9ee57 Onda 2c — finish Cat 3a (463/654 full, 177/590 partial)
ca5d24d Onda 2b — 6 Cat 3a W6 system-counter talents
9d7153a Onda 2a — 11 Cat 3a linear-counter (Lv0/TotalStat/OLA)
009643c fix golden food in skill efficiency (multiplier not raw %)
ca77c06 port stats engine + finish Onda 1
054fa42 Onda 1a — generalize wrap registry + 10 Cat 2 log-wrap
1a105dd drop external wrap from 178+328 (normal account-wide)
64542df audit + expand account-wide registry (+17, -1, +1 external)
22c1d61 rename "Best Character" → "Reference Character"
2371fec move "Best Character" inside Base Level
5bb3dc1 move description into Talent Bonus pane
a084d3a fix summary metrics from target's direct children
96a89bd regenerate dr artifacts with W6 rename
6c5348a rename "W3 Merit Shop" → "W6 Merit Shop" in WB19
f36d6e9 embed each booster's full sub-tree under cap breakdown
27f76e4 fix cap read from Base Level's direct child
e1ac975 add bubble-capped + ratchet support to cap registry
```
