# Idleon Tome Tracker

Spreadsheet that shows your tome points (118 tasks) compared against:
- **Best Tome**: the best player observed for each task (99.9th percentile)
- **Compare Tome**: a specific other player (Player 2), task by task

100% automatic via the public IdleonToolbox API. Works for any player with a
public profile in IT.

## Setup (one time, ~2 min)

1. Upload `Idleon_Tome_Tracker.xlsx` to Google Drive
2. Right-click → Open with → Google Sheets
3. **Extensions → Apps Script**
4. Delete the contents, paste `Code_Tome.gs`
5. Ctrl+S (name the project)
6. Back in the sheet, press F5
7. New menu appears: **IT Tome**
8. Click **Refresh everything** (first time will ask for authorization)

## How to use

- **Config!B5** → your player name (Player 1)
- **Config!B6** → friend's name (Player 2, for comparison)
- **Menu IT Tome → Refresh everything** → pulls everything and populates both tabs

Want to compare other people? Change the names in Config and click Refresh
again.

## What each tab shows

### Best Tome (118 rows)
- `#` → task index (1-118)
- `Tome Task` → name
- `My Pts` → your points
- `Top Pts (99.9%)` → points of the player at the 99.9th percentile (proxy
  for "best player")
- `Diff to Top` → how much you're missing
- `% of Top` → percentage, color coded: green ≥ 90%, yellow 50-90%, red < 50%

### Compare Tome (118 rows + totals)
- `#`, `Tome Task` → identical
- `Player 1 Pts` / `Player 2 Pts` → points for each
- `Diff (P1 - P2)` → positive = you win, negative = you lose. Green/red.
- `Winner` → text: the name of the winner or "tie"
- Last row → totals + scoreboard (X wins - Y wins - Z ties)

## API endpoints used

- `https://profiles.idleontoolbox.workers.dev/api/profiles/?profile=NAME` →
  full player profile (`parsedData.tomePoints` is the array of 118 points)
- `https://profiles.idleontoolbox.workers.dev/api/tome-percentiles` →
  distribution per task

## Limitations

- IT updates ~once a day. Multiple refreshes won't change anything.
- Profile must be Public (or Anonymous) — set this in IT → Account → Profile
  Access.
- "Top Pts" is the 99.9th percentile, not the theoretical absolute max of
  each task. Tasks with a hard cap (e.g. Account LV cap 1710) usually have
  99.9% = cap.

## Menu

```
IT Tome
├── Refresh everything          (does everything in one shot)
├── Build Best Tome
├── Build Compare Tome
├── ──────────
├── Reset Config layout
└── About
```

## Distributing publicly

Same strategy as the leaderboards sheet: anyone makes a copy, pastes
`Code_Tome.gs`, swaps the names in Config!B5 and B6, clicks Refresh. Works
with any public profile.
