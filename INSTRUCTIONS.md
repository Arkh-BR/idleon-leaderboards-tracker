# Idleon Leaderboards Tracker v2 (100% automatic)

This spreadsheet pulls all 153 IdleonToolbox leaderboards automatically and
shows your position in each one. **No manual typing required.**

Files:
- `Idleon_Leaderboards.xlsx` — the template sheet
- `Code.gs` — the Apps Script

## Setup (one time, ~2 minutes)

1. Upload `Idleon_Leaderboards.xlsx` to Google Drive
2. Right-click → Open with → Google Sheets
3. Go to **Extensions → Apps Script**
4. Delete whatever code is there and paste the contents of `Code.gs`
5. Ctrl+S to save (name the project)
6. Close the Apps Script tab
7. Go back to the sheet and press F5
8. A new menu appears: **📊 IT Leaderboards**
9. Click **🔄 Refresh data** → authorize on the first run

## Usage

- **Config** tab, cell **B1** → your in-game name. Change it and click Refresh
  to view another account.
- **Leaderboards** tab → 153 leaderboards. The **My Rank** column is colored
  (gold, silver, bronze, green) if you're in the top 10.
- **Diff vs #1** and **% of #1** are computed automatically.
- Top 10 of each leaderboard in columns G through AA.

## How it works (for the curious)

I found out by reading the IdleonToolbox source
(github.com/Morta1/IdleonToolbox, in `services/profiles.js`) that there's an
**undocumented** parameter on the public API:

```
https://profiles.idleontoolbox.workers.dev/api/leaderboards?leaderboard=<category>&leaderboardUser=<your name>
```

This endpoint returns the player's **rank + score** for **every leaderboard in
that category**, with no authentication, even if they're not in the top 10.
It's exactly what the site uses to render the row for the logged-in user.

The Apps Script makes 14 calls to that API (2 per category × 7 categories):
1. Top 10 of the leaderboard
2. The player's rank+score

It combines the two and populates the sheet. About ~5 seconds for a full
refresh.

## Sharing with others

Whoever wants to use it:
1. Makes a copy of your sheet (File → Make a copy)
2. Pastes the same `Code.gs` into the copy's Apps Script
3. Changes Config!B1 to their player name
4. Clicks Refresh

Since the script only uses the public IdleonToolbox API, **it works for
anyone, with no login**. You don't need IT logged in in the browser (that was
a wrong assumption I had in v1 — the `&leaderboardUser=NAME` parameter makes
it unnecessary).

## Troubleshooting

- **"I don't see the IT Leaderboards menu"** → reload the page (F5)
- **"Authorization error"** → On the first run Google asks for permission.
  Accept it ("Review permissions" → pick your account → "Advanced" → "Go to
  (project) (unsafe)" → "Allow"). It's safe: the script only uses
  `UrlFetchApp` for the public IT API.
- **"Empty data for my account"** → check that the name in Config!B1 matches
  exactly the MainChar shown on IdleonToolbox (case-insensitive). If yours
  shows as Anon#xxxxxx (anonymous profile), use that exact format.
- **"API returned 429"** → too many refreshes in a short time. Wait a few
  minutes.

## Known limitations

- The IT API updates ~once per day, so refreshing very often won't change
  anything
- If you set your IT profile to private (Account → Profile access → private),
  the API doesn't return your data — it needs to be Public or Anonymous
