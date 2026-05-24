# Idleon Leaderboards Tracker

Tracks any player's position across all 153
[IdleonToolbox](https://idleontoolbox.com) leaderboards, fully automatic.

Comes in two flavors:

## 1. Web version (recommended)

Next.js site under [`web/`](web/) — rich UI with filters, search, sortable
columns, expandable top 10 per leaderboard, and a dashboard with tier summary,
heatmap by category, worst positions, quick wins, and best positions. Works
for any player (input field).

**One-click deploy on Vercel:** [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Arkh-BR/idleon-leaderboards-tracker&root-directory=web)

To run locally:

```bash
cd web
npm install
npm run dev   # http://localhost:3000
```

More details in [`web/README.md`](web/README.md).

## 2. Spreadsheet version (Google Sheets)

The original version — `Idleon_Leaderboards.xlsx` + `Code.gs` (Apps Script).
Full instructions in [`INSTRUCTIONS.md`](INSTRUCTIONS.md).

Handy if you'd rather work in a spreadsheet than in a website.

## Tome Tracker (bonus)

`Idleon_Tome_Tracker.xlsx` + the `Code_Tome*.gs` files are a separate
spreadsheet that surfaces your Best Tome — instructions in
[`INSTRUCTIONS_TOME.md`](INSTRUCTIONS_TOME.md).

---

Data source: [idleontoolbox.com](https://idleontoolbox.com) (public API, no
authentication required). IT's code:
[Morta1/IdleonToolbox](https://github.com/Morta1/IdleonToolbox).
