// Curated list of Idleon spreadsheets, split into the ones I maintain and the
// ones from the wider community. Pure data — edit the two arrays below to add,
// remove or reorder links. The /sheets page renders each entry as a card.

export type SheetLink = {
  /** Display name shown on the card. */
  name: string;
  /** URL the card links to (Google Sheets, Excel Online, etc.). */
  url: string;
  /** One-line description of what the sheet covers. */
  description?: string;
  /** Author/credit — used for community sheets. */
  author?: string;
};

// My own sheets.
export const mySheets: SheetLink[] = [
  {
    name: "Masterclass Upgrade Planner",
    url: "https://docs.google.com/spreadsheets/d/17CgOtmjhJMH0ZbffOn2ICQfO5n7kUiiLIAQm22WgikY/",
    description:
      "Plan and prioritize character upgrades — paste your IdleonToolbox save JSON and it does the rest.",
  },
  {
    name: "Clam Work Optimizer",
    url: "https://docs.google.com/spreadsheets/d/1Hhfidu8XnT_Y3meVA-ZfGQPVr5p8WU0oV8GVrcGDghs/",
    description:
      "Optimize and track your account and character stats from your IdleonToolbox save JSON.",
  },
];

// Community / third-party sheets.
export const communitySheets: SheetLink[] = [
  {
    name: "AlmostPsycho's Sampling Sheet",
    url: "https://docs.google.com/spreadsheets/d/1at-y9t5ohYky33nOLoSxHYeyRX-3T91paj-nTSHrB3c/edit?gid=1826222324#gid=1826222324",
    description:
      "Comprehensive sampling guide — optimal gear, food, prayers and more. An updated take on Herus' classic sheet.",
    author: "AlmostPsycho",
  },
  {
    name: "Sampling & Skilling Checklist",
    url: "https://docs.google.com/spreadsheets/d/14KjNtI7U34fp6O-212xRDd6EePb_YVXE17RDXH5LIQg/edit?gid=849248956#gid=849248956",
    description:
      "Optimal gear, cards and item progression across every Idleon skill.",
    author: "alex_x90",
  },
  {
    name: "Justice Cheat Sheet",
    url: "https://docs.google.com/spreadsheets/d/1KOfrmDPKd7brbkh_Dt2WRvLeA_oxX2EZDpkxP5fKxt0/",
    description: "Strategy and decision cheat sheet for in-game choices.",
  },
  {
    name: "Divinity Points Optimizer",
    url: "https://docs.google.com/spreadsheets/d/1jvd-llYcfofzAI6xwhYocJ2vhQMZRYvTHYXHfeiCGrQ/edit?gid=0#gid=0",
    description:
      "Optimal upgrade paths for Blessing Bonus and Points per Coral.",
  },
  {
    name: "BoneJoePickle HP Calculator",
    url: "https://docs.google.com/spreadsheets/d/1Z1oMka1tzl89rErYHDXvU7JMHIr14DWOLSdfeZlrYBk/edit?gid=1042543501#gid=1042543501",
    description: "Calculates HP boosts for your characters.",
    author: "Hotair",
  },
  {
    name: "Opal Distribution Optimizer",
    url: "https://docs.google.com/spreadsheets/d/1_Z0-mJKRMxjFb0CSmg9MlfxDgdtwNyeVDd-7Bb1wXzs/edit?gid=0#gid=0",
    description:
      "Optimal Opal distribution among villagers to maximize EXP gains.",
  },
  {
    name: "Trialpears' Land Rank Optimizer",
    url: "https://docs.google.com/spreadsheets/d/1AFsA_eWCkcEoQk-oTR4YmrhZrLrpTqcGu52dtWdeIEk/edit?gid=1181979417#gid=1181979417",
    description: "Maximizes your farming Land Rank allocation from your stats.",
    author: "Trialpears",
  },
  {
    name: "Summoning Boss Tracker",
    url: "https://docs.google.com/spreadsheets/d/1Y5oRFBz4AsTDdfHg4eBtEFATfPq7nykjovylaHMpXg4/edit?gid=1115706497#gid=1115706497",
    description: "Tracks Summoning boss kills and requirements.",
    author: "neruard",
  },
  {
    name: "Weekly Boss Rotations",
    url: "https://docs.google.com/spreadsheets/d/1z1P2ouvYhe2pryWoF0kIQE7QichYpJt1GaPPos-e-aw/edit?gid=0#gid=0",
    description: "Weekly boss rotation schedule and character requirements.",
    author: "DiamondDoge",
  },
  {
    name: "Ideal Levels for Owl @ Resets 21+",
    url: "https://docs.google.com/spreadsheets/d/17XBPtpRA2N5N7VU0tUnRtIg7sFyukyDp2L3CT_fCcBw/edit?gid=0#gid=0",
    description:
      "Recommended character levels per upgrade across Owl resets 21+.",
    author: "AliceGator",
  },
  {
    name: "Asbjørn's Resource Sheet",
    url: "https://docs.google.com/spreadsheets/d/1WmkzuDiF8yoPQxJ5auBzyAZODJEEB7mCxWCIcF1uhGY/edit?gid=799216603#gid=799216603",
    description:
      "Resource, skilling, monster and crafting reference across the game.",
    author: "Asbjørn",
  },
  {
    name: "Antho & Arkh's Guide Sheet",
    url: "https://docs.google.com/spreadsheets/d/1IcxwlHKPcw57PJxOWmtCJTP2Iv6ubdRSEwzMjbH476U/edit?gid=1589005997#gid=1589005997",
    description:
      "Multiple helpers in one — tomes, drop rates, bubbles and more.",
    author: "Antho982 & Arkh",
  },
];

// Community sites — non-spreadsheet tools, wikis and dashboards.
export const communitySites: SheetLink[] = [
  {
    name: "IdleonToolbox",
    url: "https://idleontoolbox.com/",
    description:
      "The essential save analyzer — optimize your account and track everything across characters.",
  },
  {
    name: "The Idleon Efficiency",
    url: "https://www.idleonefficiency.com/",
    description:
      "Become more efficient — stamps, account info and achievement tracking in one dashboard.",
  },
  {
    name: "Idleon Insight",
    url: "https://idleoninsight.com/",
    description: "Account analysis and optimization tools for Idleon.",
  },
  {
    name: "IdleOn Wiki",
    url: "https://idleon.wiki/wiki/Main_Page",
    description:
      "The community wiki — items, monsters, mechanics, drop tables and guides.",
  },
  {
    name: "Arcane Drops",
    url: "https://codepen.io/NotCorgan/pen/MYwLmPz",
    description: "Corgan's Arcane drops calculator.",
    author: "Corgan",
  },
  {
    name: "Idleon Research Optimizer",
    url: "https://corgan.github.io/idleon-research-optimizer",
    description:
      "Plans and optimizes your research strategy — part of Corgan's Idleon Builds calculators.",
    author: "Corgan",
  },
  {
    name: "Idleon Daily Checklist",
    url: "https://symbiotescorns.github.io/idleon-checklist/",
    description:
      "Daily and weekly reset checklist with built-in timers to track your tasks.",
    author: "symbiotescorns",
  },
];
