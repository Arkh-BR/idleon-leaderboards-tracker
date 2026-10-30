# Notes for coding agents

- The game's `N.js` is the only source of truth for formulas. IdleonToolbox is a
  third-party port: matching it proves nothing.
- A stat on the site differs from the in-game value (DR, Coin, EXP…)? Follow
  `web/scripts/dr-debug/README.md`. It covers capturing the save at the moment of
  the reading, the two-reading bisection, the N.js scans of what an update
  changed, and the traps already found.
- Real-save regression tests skip silently when the private saves are missing
  from `web/scripts/updater/golden/.cache/` (gitignored). A green run without
  them proves little.
