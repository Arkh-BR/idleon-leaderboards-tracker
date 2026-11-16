# Idleon Leaderboards — Web version

Web app counterpart to the `Idleon_Leaderboards.xlsx` spreadsheet. Shows any
player's position across all 220 [IdleonToolbox](https://idleontoolbox.com)
leaderboards (the count follows IT's `/meta`), with:

- IT's own tabs and sections, a jump-to-board search, and sorting
- Expandable top 100 per leaderboard, around your rank
- Overview (global top 10) and a Dashboard: progress since your snapshot, tier
  summary, strength by section, worst positions, cheapest climbs, points to
  reach the top 100 / top 10, maxed boards you're missing, your best positions,
  global rivals with head-to-head, and your rank history
- Works for any player (input field with name autocomplete)
- Server-side cache (meta 30 min, player 15 min, board 30 min, names 10 min;
  the IT API only updates ~once a day anyway)

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** for styling
- The `/api/lb/*` routes act as a server-side proxy
  (required because IT blocks direct cross-origin CORS calls from the browser)

## Run locally

Requires Node.js 20+ (tested on Node 24).

```bash
cd web
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run build
npm start
```

## Deploy on Vercel (recommended, free)

1. Push the repo to GitHub
2. At [vercel.com/new](https://vercel.com/new), import the repo
3. **Root Directory:** `web`
4. Framework Preset: Next.js (auto-detected)
5. Deploy → done, URL is `https://your-project.vercel.app`

No env vars. No database. Nothing besides Node.

## Architecture

```
web/
├── app/
│   ├── api/lb/{meta,player,board,names}/route.ts  # Server-side proxy for the IT leaderboards API
│   ├── leaderboards/page.tsx       # The tracker page
│   ├── layout.tsx
│   └── globals.css
├── components/leaderboards/
│   ├── LbPage.tsx                  # Page shell: player input, cards, tabs
│   ├── BoardTable.tsx              # One IT tab's boards, with expandable top 100
│   ├── LbOverview.tsx              # Global top 10 + tab cards
│   └── LbDashboard.tsx             # Dashboard sections
├── scripts/update-lb-snapshot.ts   # Daily cutoffs + meta snapshot (GitHub Action)
└── lib/
    ├── leaderboards/               # IT fetch + budgets, snapshot, metrics, history
    ├── registry.ts                 # Legacy board list (used by the collector scripts)
    ├── format.ts                   # Idleon notation (M/B/T/Q/QQ/QQQ)
    └── rank.ts                     # Rank colors and tiers
```

### Why the server-side proxy?

The `profiles.idleontoolbox.workers.dev` API responds 200 server-side, but
the OPTIONS preflight **does not return `Access-Control-Allow-Origin`**, so
the browser blocks direct calls (`net::ERR_FAILED`). The Next.js API route
makes the call server-side (with the Origin and User-Agent agreed with IT's
owner) and returns it to the frontend with implicit CORS (same origin).

The in-memory cache lasts 30 min for meta and boards, 15 min per player and
10 min per name search (the IT API only updates ~once a day). Upstream fetches
are capped at 500 a day, name search at 150 of those.

## Known limitations

- Same as the spreadsheet: if the player's IT profile is "Private", the API
  returns nothing — ask them to switch to Public or Anonymous in IT → Account
  → Profile Access
- Anonymous names (`Anon#xxxxxx`) must be typed in that exact format
- The cache is per serverless instance; on multi-region deploys each region
  has its own cache (not a problem in practice)
