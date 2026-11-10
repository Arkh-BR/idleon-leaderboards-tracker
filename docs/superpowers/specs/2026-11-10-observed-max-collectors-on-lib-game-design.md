# Observed Max collectors on `lib/game`: design

Date: 2026-11-10. Related: `2026-11-03-game-engine-rewrite-design.md`, `2026-11-09-dr-v1-on-lib-game-design.md`.

## Goal

The nine collectors that build each page's Observed Max reference (`web/scripts/update-top-*.ts`, run every 3 days by `.github/workflows/refresh-top-max.yml`) compute on `lib/game` instead of `lib/arkh`.

Success:
- the reference is built with the same math the page uses, so the best-of-every-source total is the page's own total;
- the generated files keep their names, constants and shape, so the pages don't change;
- nothing in `scripts/_shared` or `scripts/update-top-*.ts` imports `@/lib/arkh`.

## User decisions (2026-11-10)

- **A. Numbers:** where `lib/game` differs from `lib/arkh`, the reference follows `lib/game`, as every migrated page already does.
- **B. DR V1:** port its current rules faithfully: two accumulators (non-Elemental-Sorcerer and Elemental Sorcerer), the Family Bonus 68 graft, the 8-card cap, and the profiles of talents 279 and 24.
- **C. Regeneration:** after the merge, Claude triggers `refresh-top-max` through `workflow_dispatch`.

## Architecture

The runner's contract stays: pools of items, best per item position, class families and gating, one `combine` per profile, and the same file renderer.

### Runner

`scripts/_shared/topStatCollector.ts` changes only where it touches `lib/arkh`:
- local types `Node = StatResult["tree"]` and `Pool = { items: Node[] }`;
- `neutralValue` and `StatGroup` come from `lib/statTracker/groups`;
- a pure `collectReference(cfg, saves)` that writes nothing, with `runTopCollector` keeping the I/O;
- a `--newest N` flag for offline runs;
- a count of refused characters (`MissingSaveKey`, `TreeTotalMismatch`) instead of a silent skip.

Also:
- `classGating.ts` and `hackers.ts` drop their `lib/arkh` imports.
- `frankenstein.ts` and `reconcile.ts`, which only their own tests import, are deleted.

### Shared helpers

New file `scripts/_shared/gamePools.ts`:
- `poolsOf(tree, parents)` reads a page tree into pools. The items are each parent's children, in their fixed order.
- `groupedCombine(root, groups, model)` rebuilds the tree, with each group's value from `groupVal` and the total from the page's gains model (`totalFromFlat`).
- `bestMap(save, ci, score, accept)` replaces `lib/arkh`'s map pickers, scoring with `ArcaneType("ArcaneMapMulti_bon", slot)`.

### Per stat

| Stat | Values from | Combine |
|---|---|---|
| Coin, EXP, DR V2, Artifact Find | the `lib/game` tracker | `groupedCombine` with the page's grouped model |
| Damage | `computeGameDamage` | `damageGainsModel`, with `layerOf` exported from the tracker |
| AFK Gains | `computeGameAfkGains` | `afkGainsModel` |
| Multikill | `computeGameMultikill` | `multikillGainsModel` and `mkHalves` |
| DR V1 | `computeGameDropRateV1`, its rows by source id | new: the tracker is split into `v1Rows` and `v1Assemble`, and the collector keeps its rules (decision B) |
| Talents | already on `lib/game` | type import only |

The `*_CLASS_TALENTS` lists move into each `lib/<stat>/layers.ts`. `lib/dropRate/arcaneBonus.ts`, the old DR V1 map picker, which its header calls a port of Arkh's code, is replaced by `bestMap` and deleted if nothing else uses it.

## Validation

None of this uses the network.

- **Round trip:** a test (`skipIf` without saves) checks, for each of the nine collectors on the newest save, that `combine(computePools(save, ci))` gives the tracker's total and the same flat tree at item level and above.
- **Old against new:** a temporary script runs the old and the new collectors on the 5 newest local saves. It prints ceilings, paths found on only one side, and value differences. Each difference must trace back to a KNOWN row in the tracker tests. The script is deleted with `lib/arkh`.
- **Rendering:** one offline end-to-end run per collector into a scratch file.
- **Gate:** clean suite on Node 22, and `tsc`.

## Risks

- **Fewer usable players:** `lib/game` refuses saves with unported load steps. The 20-player floor still protects publishing, and the refused count is logged.
- **Cron time:** `lib/game` traces run per character inside a 12-minute cron step. The compare script measures ms per character.
- **Below-source paths:** these change to the N.js call names. Compare badges at that depth start working again after regeneration.
