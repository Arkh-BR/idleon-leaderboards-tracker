# Idleon Toolbox code

The parsers, utilities and data in this directory come from
[Idleon Toolbox](https://github.com/Morta1/IdleonToolbox) by Morta1, licensed
under the GNU General Public License v3.0 (see [LICENSE](../../../LICENSE)).

**These files have been modified.** They were copied from Idleon Toolbox on
2026-05-25 and have been changed since:

- 2026-05-25: `_stubs/` and `services/profiles.ts` stand in for UI-only modules
  the parsers import; they are not Idleon Toolbox code.
- 2026-06-01: `parsers/world-3/refinery.ts` rounds refinery cycle times up, as
  the game does.
- 2026-06-22: `parsers/misc.ts` follows the game's reworked friend bonus curve.
- 2026-09-16: `parsers/misc.ts` reads stage-2 (upgraded) companion bonuses.

`git log -- web/lib/it` lists every change.
