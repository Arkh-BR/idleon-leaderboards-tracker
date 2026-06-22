// web/lib/protest/config.ts

// Single switch for protest mode. Flip to `false` (or `git revert` the protest
// commit) to instantly restore the whole site to normal.
export const PROTEST_MODE = false;

// All user-facing protest copy lives here so the page/middleware stay logic-only.
export const PROTEST = {
  discordInvite: "https://discord.gg/bTcgBgnv",
  bugReportChannel: "#bug-reports",
  headline: "THE TRACKERS ARE ON STRIKE",
  subhead:
    "Every tool on this site is offline on purpose — and will stay offline until a game-breaking bug is fixed.",
  whatsBroken: [
    "A game bug prevents players from accessing characters located on World 1, 2 and 3 maps — the account becomes effectively unplayable.",
    'It only affects accounts that had a dungeon XP overflow before the Caverns update. That update "fixed" the overflow — but introduced this bug as a side effect.',
  ],
  steps: [
    "Join the official Idleon Discord",
    "Go to the #bug-reports channel",
    "Paste the report below — that's it",
  ],
  reportText:
    "🐛 Bug: After the Caverns update (the one that fixed the dungeon XP overflow), I can't access characters located on World 1–3 maps. Only happens on accounts that had a dungeon XP overflow before that update. The account is now unplayable. Please prioritize a fix 🙏",
} as const;
