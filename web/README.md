# Idleon Leaderboards — Web version

Web app counterpart to the `Idleon_Leaderboards.xlsx` spreadsheet. Shows any
player's position across all 153 [IdleonToolbox](https://idleontoolbox.com)
leaderboards, with:

- Search, category filter, and column sorting
- Expandable top 10 per leaderboard
- Dashboard with tier summary, heatmap by category, worst positions,
  quick wins, and your best 30
- Works for any player (input field)
- Server-side cache (15 minutes per player; the IT API only updates ~once a
  day anyway)

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** for styling
- The `/api/leaderboards` route acts as a server-side proxy
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
│   ├── api/leaderboards/route.ts   # Server-side proxy for the IT API
│   ├── layout.tsx
│   ├── page.tsx                    # Main UI (tabs + player input)
│   └── globals.css
├── components/
│   ├── LeaderboardsTable.tsx       # Filterable table of all 153 leaderboards
│   └── Dashboard.tsx               # 5 analytical sections
└── lib/
    ├── registry.ts                 # The 153 leaderboards (ported from Code.gs)
    ├── format.ts                   # Idleon notation (M/B/T/Q/QQ/QQQ)
    └── rank.ts                     # Rank colors and tiers
```

### Why the server-side proxy?

The `profiles.idleontoolbox.workers.dev` API responds 200 server-side, but
the OPTIONS preflight **does not return `Access-Control-Allow-Origin`**, so
the browser blocks direct calls (`net::ERR_FAILED`). The Next.js API route
makes the call server-side, builds a combined payload of top10 + the
player's rank/score, and returns it to the frontend with implicit CORS
(same origin).

The in-memory cache lasts 15 minutes per player (the IT API only updates
~once a day, so refetching more often is pointless).

## Known limitations

- Same as the spreadsheet: if the player's IT profile is "Private", the API
  returns nothing — ask them to switch to Public or Anonymous in IT → Account
  → Profile Access
- Anonymous names (`Anon#xxxxxx`) must be typed in that exact format
- The cache is per serverless instance; on multi-region deploys each region
  has its own cache (not a problem in practice)
