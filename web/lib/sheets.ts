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
    name: "Sampling Sheet",
    url: "https://docs.google.com/spreadsheets/d/1at-y9t5ohYky33nOLoSxHYeyRX-3T91paj-nTSHrB3c/edit?gid=1826222324#gid=1826222324",
    description:
      "Comprehensive sampling guide — optimal gear, food, prayers and more. An updated take on Herus' classic sheet.",
    author: "AlmostPsycho",
  },
];
