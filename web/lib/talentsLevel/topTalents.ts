// Hypothetical-max Effective Level trees (full depth) — the best value
// of every node across the scanned top players, computed on the Health
// Booster (a plain simple talent, so its Effective Level subtree is the
// template every simple talent shares). Effective Level = best base +
// bonus + super. Rendered as-is by the /talents Hypothetical tab.
//
// Two pools, keyed by the selected char's class:
//   HYPO_DEFAULT_TREE      — non-Elemental-Sorcerer reference (Family
//                            Bonus 68 unbuffed).
//   HYPO_TREE_OVERRIDES    — per-class overrides; Elemental_Sorcerer
//                            gets FB68 buffed by its own Family Guy.
// Every other source is account-wide, so non-ES classes share the
// default tree (they would all resolve to identical numbers anyway).
// Auto-refreshed by scripts/update-top-talents.ts.
//
// Snapshot generated: 2026-11-13T12:01:40.556Z
// Players scanned: 97

import type { ArkhNode } from "../dropRate/node";

export const HYPO_TALENTS_GENERATED_AT = "2026-11-13T12:01:40.556Z";
export const HYPO_TALENTS_PLAYERS_SCANNED = 97;

export const HYPO_DEFAULT_TREE: ArkhNode = {
  "name": "Effective Level",
  "val": 859,
  "fmt": "raw",
  "note": "Base + Bonus + Super",
  "children": [
    {
      "name": "Base Level",
      "val": 441,
      "fmt": "raw",
      "note": "min(invested, cap) — owner: Marakki",
      "children": [
        {
          "name": "Points Invested",
          "val": 441,
          "fmt": "raw",
          "note": "actual save — owner: Marakki"
        },
        {
          "name": "Max Book Lv Cap",
          "val": 441,
          "fmt": "raw",
          "note": "N.js maxBookLv",
          "children": [
            {
              "name": "Base Level (N.js literal)",
              "val": 100,
              "fmt": "+"
            },
            {
              "name": "Talent Book Library Base",
              "val": 25,
              "fmt": "+"
            },
            {
              "name": "Salt Lick 4",
              "val": 20,
              "fmt": "+",
              "children": [
                {
                  "name": "Salt Lick 4 Lv",
                  "val": 10,
                  "fmt": "raw"
                },
                {
                  "name": "Per Lv",
                  "val": 2,
                  "fmt": "raw"
                }
              ]
            },
            {
              "name": "W3 Merit Shop Unlock",
              "val": 10,
              "fmt": "+",
              "children": [
                {
                  "name": "W3 Merit Points Spent",
                  "val": 5,
                  "fmt": "raw"
                },
                {
                  "name": "Per Point",
                  "val": 2,
                  "fmt": "raw"
                }
              ]
            },
            {
              "name": "Checkout Takeout Achievement",
              "val": 5,
              "fmt": "+"
            },
            {
              "name": "Lv 1 Oxygen Atom",
              "val": 10,
              "fmt": "+",
              "children": [
                {
                  "name": "Atom 7 Lv",
                  "val": 72,
                  "fmt": "raw"
                }
              ]
            },
            {
              "name": "Sovereign Fury Relic",
              "val": 175,
              "fmt": "+",
              "children": [
                {
                  "name": "Artifact 21 Base",
                  "val": 25,
                  "fmt": "raw"
                },
                {
                  "name": "Artifact 21 Tier",
                  "val": 7,
                  "fmt": "raw"
                }
              ]
            },
            {
              "name": "Summoning Winner Bonus 19",
              "val": 96.09600000000002,
              "fmt": "+",
              "children": [
                {
                  "name": "Summoning Battles",
                  "val": 14,
                  "fmt": "raw",
                  "note": "4 raw × 3.5× Base = 14.00  →  then × 1.95× Higher Bonus × 3.02× Winner = 82.45",
                  "children": [
                    {
                      "name": "Cyan",
                      "val": 10.5,
                      "fmt": "+",
                      "note": "Σ Cyan (W6) battles (post-Base Multi)",
                      "children": [
                        {
                          "name": "Battle 14",
                          "val": 10.5,
                          "fmt": "raw",
                          "note": "1 kill × 3 per kill × 3.5 base = 10.5"
                        }
                      ]
                    },
                    {
                      "name": "Teal",
                      "val": 3.5,
                      "fmt": "+",
                      "note": "Σ Teal (W7) battles (post-Base Multi)",
                      "children": [
                        {
                          "name": "Battle 9",
                          "val": 3.5,
                          "fmt": "raw",
                          "note": "1 kill × 1 per kill × 3.5 base = 3.5"
                        }
                      ]
                    }
                  ]
                },
                {
                  "name": "Higher Bonus Multi",
                  "val": 1.9500000000000002,
                  "fmt": "x",
                  "note": "Pristine × Gem — the upgrade-lane multi",
                  "children": [
                    {
                      "name": "Crystal Comb Pristine Charm",
                      "val": 1.3,
                      "fmt": "x",
                      "note": "1 + lv/100",
                      "children": [
                        {
                          "name": "Pristine 8 Bonus",
                          "val": 30,
                          "fmt": "raw"
                        }
                      ]
                    },
                    {
                      "name": "Gem Shop Multi",
                      "val": 1.5,
                      "fmt": "x",
                      "note": "1 + 10×lv/100",
                      "children": [
                        {
                          "name": "Gem Items 11",
                          "val": 5,
                          "fmt": "raw"
                        }
                      ]
                    }
                  ]
                },
                {
                  "name": "Winner Multi (combined)",
                  "val": 3.52,
                  "fmt": "x",
                  "note": "1 + Σ winner sources / 100",
                  "children": [
                    {
                      "name": "Sovereign Winz Lantern",
                      "val": 175,
                      "fmt": "+",
                      "children": [
                        {
                          "name": "Artifact 32 Base",
                          "val": 25,
                          "fmt": "raw"
                        },
                        {
                          "name": "Artifact 32 Tier",
                          "val": 7,
                          "fmt": "raw"
                        }
                      ]
                    },
                    {
                      "name": "W6 Merit Shop (Task)",
                      "val": 10,
                      "fmt": "+"
                    },
                    {
                      "name": "Regalis Achievement (379)",
                      "val": 1,
                      "fmt": "+"
                    },
                    {
                      "name": "Spectre Stars Achievement (373)",
                      "val": 1,
                      "fmt": "+"
                    },
                    {
                      "name": "Godshard Set",
                      "val": 15,
                      "fmt": "+"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "name": "Bonus Levels",
      "val": 293,
      "fmt": "+",
      "children": [
        {
          "name": "Symbols of Beyond ~R (Talent 149)",
          "val": 23,
          "fmt": "raw",
          "note": "intervalAdd(1,20,441)",
          "children": [
            {
              "name": "Base Level",
              "val": 441,
              "fmt": "raw",
              "note": "min(invested, cap) — owner: Marakki",
              "children": [
                {
                  "name": "Points Invested",
                  "val": 441,
                  "fmt": "raw",
                  "note": "actual save — owner: Marakki"
                },
                {
                  "name": "Max Book Lv Cap",
                  "val": 441,
                  "fmt": "raw",
                  "note": "N.js maxBookLv",
                  "children": [
                    {
                      "name": "Base Level (N.js literal)",
                      "val": 100,
                      "fmt": "+"
                    },
                    {
                      "name": "Talent Book Library Base",
                      "val": 25,
                      "fmt": "+"
                    },
                    {
                      "name": "Salt Lick 4",
                      "val": 20,
                      "fmt": "+",
                      "children": [
                        {
                          "name": "Salt Lick 4 Lv",
                          "val": 10,
                          "fmt": "raw"
                        },
                        {
                          "name": "Per Lv",
                          "val": 2,
                          "fmt": "raw"
                        }
                      ]
                    },
                    {
                      "name": "W3 Merit Shop Unlock",
                      "val": 10,
                      "fmt": "+",
                      "children": [
                        {
                          "name": "W3 Merit Points Spent",
                          "val": 5,
                          "fmt": "raw"
                        },
                        {
                          "name": "Per Point",
                          "val": 2,
                          "fmt": "raw"
                        }
                      ]
                    },
                    {
                      "name": "Checkout Takeout Achievement",
                      "val": 5,
                      "fmt": "+"
                    },
                    {
                      "name": "Lv 1 Oxygen Atom",
                      "val": 10,
                      "fmt": "+",
                      "children": [
                        {
                          "name": "Atom 7 Lv",
                          "val": 72,
                          "fmt": "raw"
                        }
                      ]
                    },
                    {
                      "name": "Sovereign Fury Relic",
                      "val": 175,
                      "fmt": "+",
                      "children": [
                        {
                          "name": "Artifact 21 Base",
                          "val": 25,
                          "fmt": "raw"
                        },
                        {
                          "name": "Artifact 21 Tier",
                          "val": 7,
                          "fmt": "raw"
                        }
                      ]
                    },
                    {
                      "name": "Summoning Winner Bonus 19",
                      "val": 96.09600000000002,
                      "fmt": "+",
                      "children": [
                        {
                          "name": "Summoning Battles",
                          "val": 14,
                          "fmt": "raw",
                          "note": "4 raw × 3.5× Base = 14.00  →  then × 1.95× Higher Bonus × 3.02× Winner = 82.45",
                          "children": [
                            {
                              "name": "Cyan",
                              "val": 10.5,
                              "fmt": "+",
                              "note": "Σ Cyan (W6) battles (post-Base Multi)",
                              "children": [
                                {
                                  "name": "Battle 14",
                                  "val": 10.5,
                                  "fmt": "raw",
                                  "note": "1 kill × 3 per kill × 3.5 base = 10.5"
                                }
                              ]
                            },
                            {
                              "name": "Teal",
                              "val": 3.5,
                              "fmt": "+",
                              "note": "Σ Teal (W7) battles (post-Base Multi)",
                              "children": [
                                {
                                  "name": "Battle 9",
                                  "val": 3.5,
                                  "fmt": "raw",
                                  "note": "1 kill × 1 per kill × 3.5 base = 3.5"
                                }
                              ]
                            }
                          ]
                        },
                        {
                          "name": "Higher Bonus Multi",
                          "val": 1.9500000000000002,
                          "fmt": "x",
                          "note": "Pristine × Gem — the upgrade-lane multi",
                          "children": [
                            {
                              "name": "Crystal Comb Pristine Charm",
                              "val": 1.3,
                              "fmt": "x",
                              "note": "1 + lv/100",
                              "children": [
                                {
                                  "name": "Pristine 8 Bonus",
                                  "val": 30,
                                  "fmt": "raw"
                                }
                              ]
                            },
                            {
                              "name": "Gem Shop Multi",
                              "val": 1.5,
                              "fmt": "x",
                              "note": "1 + 10×lv/100",
                              "children": [
                                {
                                  "name": "Gem Items 11",
                                  "val": 5,
                                  "fmt": "raw"
                                }
                              ]
                            }
                          ]
                        },
                        {
                          "name": "Winner Multi (combined)",
                          "val": 3.52,
                          "fmt": "x",
                          "note": "1 + Σ winner sources / 100",
                          "children": [
                            {
                              "name": "Sovereign Winz Lantern",
                              "val": 175,
                              "fmt": "+",
                              "children": [
                                {
                                  "name": "Artifact 32 Base",
                                  "val": 25,
                                  "fmt": "raw"
                                },
                                {
                                  "name": "Artifact 32 Tier",
                                  "val": 7,
                                  "fmt": "raw"
                                }
                              ]
                            },
                            {
                              "name": "W6 Merit Shop (Task)",
                              "val": 10,
                              "fmt": "+"
                            },
                            {
                              "name": "Regalis Achievement (379)",
                              "val": 1,
                              "fmt": "+"
                            },
                            {
                              "name": "Spectre Stars Achievement (373)",
                              "val": 1,
                              "fmt": "+"
                            },
                            {
                              "name": "Godshard Set",
                              "val": 15,
                              "fmt": "+"
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "name": "Maroon Warship (Achievement 291)",
          "val": 1,
          "fmt": "raw"
        },
        {
          "name": "Family Bonus 68 (Mage)",
          "val": 16,
          "fmt": "raw",
          "note": "floor(decay × Family Guy Multi if active)",
          "children": [
            {
              "name": "Best Mage Lv",
              "val": 1985,
              "fmt": "raw",
              "note": "max across account — 1 mage char",
              "children": [
                {
                  "name": "Char 1 Lv",
                  "val": 1920,
                  "fmt": "raw",
                  "note": "Mirakki — elemental sorcerer (cls 34)"
                }
              ]
            },
            {
              "name": "Family Guy Multi (×) — potential buff",
              "val": 1.3580272822665267,
              "fmt": "raw",
              "note": "1 + decay(x1, x2, Base+Bonus)/100",
              "children": [
                {
                  "name": "Base Level",
                  "val": 441,
                  "fmt": "raw",
                  "note": "min(invested, cap)",
                  "children": [
                    {
                      "name": "Points Invested",
                      "val": 441,
                      "fmt": "raw",
                      "note": "save=441"
                    },
                    {
                      "name": "Max Book Lv Cap",
                      "val": 441,
                      "fmt": "raw",
                      "note": "N.js maxBookLv",
                      "children": [
                        {
                          "name": "Base Level (N.js literal)",
                          "val": 100,
                          "fmt": "+"
                        },
                        {
                          "name": "Talent Book Library Base",
                          "val": 25,
                          "fmt": "+"
                        },
                        {
                          "name": "Salt Lick 4",
                          "val": 20,
                          "fmt": "+",
                          "note": "Lv × Per Lv",
                          "children": [
                            {
                              "name": "Salt Lick 4 Lv",
                              "val": 10,
                              "fmt": "raw"
                            },
                            {
                              "name": "Per Lv",
                              "val": 2,
                              "fmt": "raw"
                            }
                          ]
                        },
                        {
                          "name": "W3 Merit Shop Unlock",
                          "val": 10,
                          "fmt": "+",
                          "note": "Pts × Per Point",
                          "children": [
                            {
                              "name": "W3 Merit Points Spent",
                              "val": 5,
                              "fmt": "raw"
                            },
                            {
                              "name": "Per Point",
                              "val": 2,
                              "fmt": "raw"
                            }
                          ]
                        },
                        {
                          "name": "Checkout Takeout Achievement",
                          "val": 5,
                          "fmt": "+"
                        },
                        {
                          "name": "Lv 1 Oxygen Atom",
                          "val": 10,
                          "fmt": "+",
                          "note": "10 × min(Lv, 1)",
                          "children": [
                            {
                              "name": "Atom 7 Lv",
                              "val": 72,
                              "fmt": "raw"
                            }
                          ]
                        },
                        {
                          "name": "Sovereign Fury Relic",
                          "val": 175,
                          "fmt": "+",
                          "note": "Base × Tier",
                          "children": [
                            {
                              "name": "Artifact 21 Base",
                              "val": 25,
                              "fmt": "raw"
                            },
                            {
                              "name": "Artifact 21 Tier",
                              "val": 7,
                              "fmt": "raw"
                            }
                          ]
                        },
                        {
                          "name": "Summoning Winner Bonus 19",
                          "val": 96.09600000000002,
                          "fmt": "+",
                          "note": "Raw × Higher Bonus × Winner Multi",
                          "children": [
                            {
                              "name": "Summoning Battles",
                              "val": 14,
                              "fmt": "raw",
                              "note": "4 raw × 3.5× Base = 14.00  →  then × 1.95× Higher Bonus × 3.02× Winner = 82.45",
                              "children": [
                                {
                                  "name": "Cyan",
                                  "val": 10.5,
                                  "fmt": "+",
                                  "note": "Σ Cyan (W6) battles (post-Base Multi)",
                                  "children": [
                                    {
                                      "name": "Battle 14",
                                      "val": 10.5,
                                      "fmt": "raw",
                                      "note": "1 kill × 3 per kill × 3.5 base = 10.5"
                                    }
                                  ]
                                },
                                {
                                  "name": "Teal",
                                  "val": 3.5,
                                  "fmt": "+",
                                  "note": "Σ Teal (W7) battles (post-Base Multi)",
                                  "children": [
                                    {
                                      "name": "Battle 9",
                                      "val": 3.5,
                                      "fmt": "raw",
                                      "note": "1 kill × 1 per kill × 3.5 base = 3.5"
                                    }
                                  ]
                                }
                              ]
                            },
                            {
                              "name": "Higher Bonus Multi",
                              "val": 1.9500000000000002,
                              "fmt": "x",
                              "note": "Pristine × Gem — the upgrade-lane multi",
                              "children": [
                                {
                                  "name": "Crystal Comb Pristine Charm",
                                  "val": 1.3,
                                  "fmt": "x",
                                  "note": "1 + lv/100",
                                  "children": [
                                    {
                                      "name": "Pristine 8 Bonus",
                                      "val": 30,
                                      "fmt": "raw"
                                    }
                                  ]
                                },
                                {
                                  "name": "Gem Shop Multi",
                                  "val": 1.5,
                                  "fmt": "x",
                                  "note": "1 + 10×lv/100",
                                  "children": [
                                    {
                                      "name": "Gem Items 11",
                                      "val": 5,
                                      "fmt": "raw"
                                    }
                                  ]
                                }
                              ]
                            },
                            {
                              "name": "Winner Multi (combined)",
                              "val": 3.52,
                              "fmt": "x",
                              "note": "1 + Σ winner sources / 100",
                              "children": [
                                {
                                  "name": "Sovereign Winz Lantern",
                                  "val": 175,
                                  "fmt": "+",
                                  "children": [
                                    {
                                      "name": "Artifact 32 Base",
                                      "val": 25,
                                      "fmt": "raw"
                                    },
                                    {
                                      "name": "Artifact 32 Tier",
                                      "val": 7,
                                      "fmt": "raw"
                                    }
                                  ]
                                },
                                {
                                  "name": "W6 Merit Shop (Task)",
                                  "val": 10,
                                  "fmt": "+"
                                },
                                {
                                  "name": "Regalis Achievement (379)",
                                  "val": 1,
                                  "fmt": "+"
                                },
                                {
                                  "name": "Spectre Stars Achievement (373)",
                                  "val": 1,
                                  "fmt": "+"
                                },
                                {
                                  "name": "Godshard Set",
                                  "val": 15,
                                  "fmt": "+"
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  "name": "Bonus Levels",
                  "val": 290,
                  "fmt": "+",
                  "note": "Σ ATL (unbuffed FB68, excl. super)"
                }
              ]
            }
          ]
        },
        {
          "name": "Rift Slug (Companion 1)",
          "val": 35,
          "fmt": "raw",
          "children": [
            {
              "name": "Owned",
              "val": 1,
              "fmt": "raw"
            },
            {
              "name": "Bonus",
              "val": 35,
              "fmt": "raw"
            }
          ]
        },
        {
          "name": "Divinity Minor 2 (Arctis)",
          "val": 88,
          "fmt": "raw",
          "children": [
            {
              "name": "Divinity Lv",
              "val": 1050,
              "fmt": "raw"
            },
            {
              "name": "Bubble Y2 Active",
              "val": 1.4999285814611758,
              "fmt": "raw",
              "note": "0 unless BIG_P is equipped or Sheepie owned; Prisma included"
            },
            {
              "name": "Coral Kid 3",
              "val": 310,
              "fmt": "raw",
              "note": "OLA[430]"
            },
            {
              "name": "God Minor X1(2)",
              "val": 15,
              "fmt": "raw",
              "note": "GodsInfo[2][3] constant"
            }
          ]
        },
        {
          "name": "Equinox Symbols (Dream 10)",
          "val": 70,
          "fmt": "raw",
          "children": [
            {
              "name": "Base Max",
              "val": 5,
              "fmt": "raw",
              "note": "DreamUpg[10][2] game constant"
            },
            {
              "name": "Summoning WinBonus 24",
              "val": 51,
              "fmt": "raw",
              "note": "slot 24 is RAW (no multiplicative chain)",
              "children": [
                {
                  "name": "Normal Wins Bonus",
                  "val": 0,
                  "fmt": "raw",
                  "note": "Σ slot-24 contributions from owned summoning units"
                },
                {
                  "name": "Endless Wins Bonus",
                  "val": 51,
                  "fmt": "raw",
                  "note": "floor(wins/40) × perCycle + partial cycle",
                  "children": [
                    {
                      "name": "Endless Wins Count",
                      "val": 407,
                      "fmt": "raw",
                      "note": "OLA[319] — total endless summoning victories"
                    },
                    {
                      "name": "Per 40-Cycle Bonus",
                      "val": 5,
                      "fmt": "raw",
                      "note": "slot-24 contribution per 40-win cycle (game constant)"
                    }
                  ]
                }
              ]
            },
            {
              "name": "SuperBit 35 (×10)",
              "val": 10,
              "fmt": "raw",
              "note": "Gaming SuperBitType 35 unlocked? × 10"
            },
            {
              "name": "Cloud 30 (×4)",
              "val": 4,
              "fmt": "raw",
              "note": "Dream Challenge 30 completed? × 4"
            }
          ]
        },
        {
          "name": "Sneaking Completions",
          "val": 5,
          "fmt": "raw",
          "note": "raw=9"
        },
        {
          "name": "Skull of Major Talent (Grimoire 39)",
          "val": 30,
          "fmt": "raw"
        },
        {
          "name": "Kattlekruk Set",
          "val": 5,
          "fmt": "raw"
        },
        {
          "name": "Universe Talent",
          "val": 5,
          "fmt": "raw",
          "note": "Tesseract (Arcane Cultist) — +1 talent LV per level, cap 5"
        },
        {
          "name": "Super Bit 47 Lv Bonus",
          "val": 15,
          "fmt": "raw",
          "note": "max(0, floor((Lv − 500)/100))",
          "children": [
            {
              "name": "Player Lv",
              "val": 2056,
              "fmt": "raw",
              "note": "Lv0[0]"
            }
          ]
        }
      ]
    },
    {
      "name": "Super Levels",
      "val": 125,
      "fmt": "+",
      "note": "Spelunk Super Talent — active on this preset",
      "children": [
        {
          "name": "Active",
          "val": 1,
          "fmt": "raw"
        },
        {
          "name": "Base",
          "val": 50,
          "fmt": "raw"
        },
        {
          "name": "Super Duper Talents (Yellow 2)",
          "val": 50,
          "fmt": "raw",
          "note": "+10 super levels per level",
          "children": [
            {
              "name": "Base",
              "val": 10,
              "fmt": "raw"
            },
            {
              "name": "Level",
              "val": 5,
              "fmt": "raw",
              "note": "Zenith Market — Spelunk[18][7] (max 5)"
            }
          ]
        },
        {
          "name": "Zenith Super Dupers",
          "val": 25,
          "fmt": "raw",
          "note": "+1 super level per level",
          "children": [
            {
              "name": "Level",
              "val": 25,
              "fmt": "raw",
              "note": "Zenith Market — Spelunk[45][5] (max 25)"
            },
            {
              "name": "Per Lv",
              "val": 1,
              "fmt": "raw"
            }
          ]
        }
      ]
    }
  ]
};

export const HYPO_TREE_OVERRIDES: Record<string, ArkhNode> = {
  "Elemental_Sorcerer": {
    "name": "Effective Level",
    "val": 865,
    "fmt": "raw",
    "note": "Base + Bonus + Super",
    "children": [
      {
        "name": "Base Level",
        "val": 441,
        "fmt": "raw",
        "note": "min(invested, cap) — owner: Marakki",
        "children": [
          {
            "name": "Points Invested",
            "val": 441,
            "fmt": "raw",
            "note": "actual save — owner: Marakki"
          },
          {
            "name": "Max Book Lv Cap",
            "val": 441,
            "fmt": "raw",
            "note": "N.js maxBookLv",
            "children": [
              {
                "name": "Base Level (N.js literal)",
                "val": 100,
                "fmt": "+"
              },
              {
                "name": "Talent Book Library Base",
                "val": 25,
                "fmt": "+"
              },
              {
                "name": "Salt Lick 4",
                "val": 20,
                "fmt": "+",
                "children": [
                  {
                    "name": "Salt Lick 4 Lv",
                    "val": 10,
                    "fmt": "raw"
                  },
                  {
                    "name": "Per Lv",
                    "val": 2,
                    "fmt": "raw"
                  }
                ]
              },
              {
                "name": "W3 Merit Shop Unlock",
                "val": 10,
                "fmt": "+",
                "children": [
                  {
                    "name": "W3 Merit Points Spent",
                    "val": 5,
                    "fmt": "raw"
                  },
                  {
                    "name": "Per Point",
                    "val": 2,
                    "fmt": "raw"
                  }
                ]
              },
              {
                "name": "Checkout Takeout Achievement",
                "val": 5,
                "fmt": "+"
              },
              {
                "name": "Lv 1 Oxygen Atom",
                "val": 10,
                "fmt": "+",
                "children": [
                  {
                    "name": "Atom 7 Lv",
                    "val": 72,
                    "fmt": "raw"
                  }
                ]
              },
              {
                "name": "Sovereign Fury Relic",
                "val": 175,
                "fmt": "+",
                "children": [
                  {
                    "name": "Artifact 21 Base",
                    "val": 25,
                    "fmt": "raw"
                  },
                  {
                    "name": "Artifact 21 Tier",
                    "val": 7,
                    "fmt": "raw"
                  }
                ]
              },
              {
                "name": "Summoning Winner Bonus 19",
                "val": 96.09600000000002,
                "fmt": "+",
                "children": [
                  {
                    "name": "Summoning Battles",
                    "val": 14,
                    "fmt": "raw",
                    "note": "4 raw × 3.5× Base = 14.00  →  then × 1.95× Higher Bonus × 3.02× Winner = 82.45",
                    "children": [
                      {
                        "name": "Cyan",
                        "val": 10.5,
                        "fmt": "+",
                        "note": "Σ Cyan (W6) battles (post-Base Multi)",
                        "children": [
                          {
                            "name": "Battle 14",
                            "val": 10.5,
                            "fmt": "raw",
                            "note": "1 kill × 3 per kill × 3.5 base = 10.5"
                          }
                        ]
                      },
                      {
                        "name": "Teal",
                        "val": 3.5,
                        "fmt": "+",
                        "note": "Σ Teal (W7) battles (post-Base Multi)",
                        "children": [
                          {
                            "name": "Battle 9",
                            "val": 3.5,
                            "fmt": "raw",
                            "note": "1 kill × 1 per kill × 3.5 base = 3.5"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "name": "Higher Bonus Multi",
                    "val": 1.9500000000000002,
                    "fmt": "x",
                    "note": "Pristine × Gem — the upgrade-lane multi",
                    "children": [
                      {
                        "name": "Crystal Comb Pristine Charm",
                        "val": 1.3,
                        "fmt": "x",
                        "note": "1 + lv/100",
                        "children": [
                          {
                            "name": "Pristine 8 Bonus",
                            "val": 30,
                            "fmt": "raw"
                          }
                        ]
                      },
                      {
                        "name": "Gem Shop Multi",
                        "val": 1.5,
                        "fmt": "x",
                        "note": "1 + 10×lv/100",
                        "children": [
                          {
                            "name": "Gem Items 11",
                            "val": 5,
                            "fmt": "raw"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "name": "Winner Multi (combined)",
                    "val": 3.52,
                    "fmt": "x",
                    "note": "1 + Σ winner sources / 100",
                    "children": [
                      {
                        "name": "Sovereign Winz Lantern",
                        "val": 175,
                        "fmt": "+",
                        "children": [
                          {
                            "name": "Artifact 32 Base",
                            "val": 25,
                            "fmt": "raw"
                          },
                          {
                            "name": "Artifact 32 Tier",
                            "val": 7,
                            "fmt": "raw"
                          }
                        ]
                      },
                      {
                        "name": "W6 Merit Shop (Task)",
                        "val": 10,
                        "fmt": "+"
                      },
                      {
                        "name": "Regalis Achievement (379)",
                        "val": 1,
                        "fmt": "+"
                      },
                      {
                        "name": "Spectre Stars Achievement (373)",
                        "val": 1,
                        "fmt": "+"
                      },
                      {
                        "name": "Godshard Set",
                        "val": 15,
                        "fmt": "+"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "name": "Bonus Levels",
        "val": 299,
        "fmt": "+",
        "children": [
          {
            "name": "Symbols of Beyond ~R (Talent 149)",
            "val": 23,
            "fmt": "raw",
            "note": "intervalAdd(1,20,441)",
            "children": [
              {
                "name": "Base Level",
                "val": 441,
                "fmt": "raw",
                "note": "min(invested, cap) — owner: Marakki",
                "children": [
                  {
                    "name": "Points Invested",
                    "val": 441,
                    "fmt": "raw",
                    "note": "actual save — owner: Marakki"
                  },
                  {
                    "name": "Max Book Lv Cap",
                    "val": 441,
                    "fmt": "raw",
                    "note": "N.js maxBookLv",
                    "children": [
                      {
                        "name": "Base Level (N.js literal)",
                        "val": 100,
                        "fmt": "+"
                      },
                      {
                        "name": "Talent Book Library Base",
                        "val": 25,
                        "fmt": "+"
                      },
                      {
                        "name": "Salt Lick 4",
                        "val": 20,
                        "fmt": "+",
                        "children": [
                          {
                            "name": "Salt Lick 4 Lv",
                            "val": 10,
                            "fmt": "raw"
                          },
                          {
                            "name": "Per Lv",
                            "val": 2,
                            "fmt": "raw"
                          }
                        ]
                      },
                      {
                        "name": "W3 Merit Shop Unlock",
                        "val": 10,
                        "fmt": "+",
                        "children": [
                          {
                            "name": "W3 Merit Points Spent",
                            "val": 5,
                            "fmt": "raw"
                          },
                          {
                            "name": "Per Point",
                            "val": 2,
                            "fmt": "raw"
                          }
                        ]
                      },
                      {
                        "name": "Checkout Takeout Achievement",
                        "val": 5,
                        "fmt": "+"
                      },
                      {
                        "name": "Lv 1 Oxygen Atom",
                        "val": 10,
                        "fmt": "+",
                        "children": [
                          {
                            "name": "Atom 7 Lv",
                            "val": 72,
                            "fmt": "raw"
                          }
                        ]
                      },
                      {
                        "name": "Sovereign Fury Relic",
                        "val": 175,
                        "fmt": "+",
                        "children": [
                          {
                            "name": "Artifact 21 Base",
                            "val": 25,
                            "fmt": "raw"
                          },
                          {
                            "name": "Artifact 21 Tier",
                            "val": 7,
                            "fmt": "raw"
                          }
                        ]
                      },
                      {
                        "name": "Summoning Winner Bonus 19",
                        "val": 96.09600000000002,
                        "fmt": "+",
                        "children": [
                          {
                            "name": "Summoning Battles",
                            "val": 14,
                            "fmt": "raw",
                            "note": "4 raw × 3.5× Base = 14.00  →  then × 1.95× Higher Bonus × 3.02× Winner = 82.45",
                            "children": [
                              {
                                "name": "Cyan",
                                "val": 10.5,
                                "fmt": "+",
                                "note": "Σ Cyan (W6) battles (post-Base Multi)",
                                "children": [
                                  {
                                    "name": "Battle 14",
                                    "val": 10.5,
                                    "fmt": "raw",
                                    "note": "1 kill × 3 per kill × 3.5 base = 10.5"
                                  }
                                ]
                              },
                              {
                                "name": "Teal",
                                "val": 3.5,
                                "fmt": "+",
                                "note": "Σ Teal (W7) battles (post-Base Multi)",
                                "children": [
                                  {
                                    "name": "Battle 9",
                                    "val": 3.5,
                                    "fmt": "raw",
                                    "note": "1 kill × 1 per kill × 3.5 base = 3.5"
                                  }
                                ]
                              }
                            ]
                          },
                          {
                            "name": "Higher Bonus Multi",
                            "val": 1.9500000000000002,
                            "fmt": "x",
                            "note": "Pristine × Gem — the upgrade-lane multi",
                            "children": [
                              {
                                "name": "Crystal Comb Pristine Charm",
                                "val": 1.3,
                                "fmt": "x",
                                "note": "1 + lv/100",
                                "children": [
                                  {
                                    "name": "Pristine 8 Bonus",
                                    "val": 30,
                                    "fmt": "raw"
                                  }
                                ]
                              },
                              {
                                "name": "Gem Shop Multi",
                                "val": 1.5,
                                "fmt": "x",
                                "note": "1 + 10×lv/100",
                                "children": [
                                  {
                                    "name": "Gem Items 11",
                                    "val": 5,
                                    "fmt": "raw"
                                  }
                                ]
                              }
                            ]
                          },
                          {
                            "name": "Winner Multi (combined)",
                            "val": 3.52,
                            "fmt": "x",
                            "note": "1 + Σ winner sources / 100",
                            "children": [
                              {
                                "name": "Sovereign Winz Lantern",
                                "val": 175,
                                "fmt": "+",
                                "children": [
                                  {
                                    "name": "Artifact 32 Base",
                                    "val": 25,
                                    "fmt": "raw"
                                  },
                                  {
                                    "name": "Artifact 32 Tier",
                                    "val": 7,
                                    "fmt": "raw"
                                  }
                                ]
                              },
                              {
                                "name": "W6 Merit Shop (Task)",
                                "val": 10,
                                "fmt": "+"
                              },
                              {
                                "name": "Regalis Achievement (379)",
                                "val": 1,
                                "fmt": "+"
                              },
                              {
                                "name": "Spectre Stars Achievement (373)",
                                "val": 1,
                                "fmt": "+"
                              },
                              {
                                "name": "Godshard Set",
                                "val": 15,
                                "fmt": "+"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            "name": "Maroon Warship (Achievement 291)",
            "val": 1,
            "fmt": "raw"
          },
          {
            "name": "Family Bonus 68 (Mage)",
            "val": 22,
            "fmt": "raw",
            "note": "floor(decay × Family Guy Multi if active) — buffed by The Family Guy (Talent 144)",
            "children": [
              {
                "name": "Best Mage Lv",
                "val": 1985,
                "fmt": "raw",
                "note": "max across account — 1 mage char",
                "children": [
                  {
                    "name": "Char 1 Lv",
                    "val": 1920,
                    "fmt": "raw",
                    "note": "Mirakki — elemental sorcerer (cls 34) — ACTIVE char (gets Family Guy buff if it wins the slot)"
                  }
                ]
              },
              {
                "name": "Family Guy Multi (×) — potential buff",
                "val": 1.3581151832460732,
                "fmt": "raw",
                "note": "1 + decay(x1, x2, Base+Bonus)/100",
                "children": [
                  {
                    "name": "Base Level",
                    "val": 441,
                    "fmt": "raw",
                    "note": "min(invested, cap)",
                    "children": [
                      {
                        "name": "Points Invested",
                        "val": 441,
                        "fmt": "raw",
                        "note": "save=441"
                      },
                      {
                        "name": "Max Book Lv Cap",
                        "val": 441,
                        "fmt": "raw",
                        "note": "N.js maxBookLv",
                        "children": [
                          {
                            "name": "Base Level (N.js literal)",
                            "val": 100,
                            "fmt": "+"
                          },
                          {
                            "name": "Talent Book Library Base",
                            "val": 25,
                            "fmt": "+"
                          },
                          {
                            "name": "Salt Lick 4",
                            "val": 20,
                            "fmt": "+",
                            "note": "Lv × Per Lv",
                            "children": [
                              {
                                "name": "Salt Lick 4 Lv",
                                "val": 10,
                                "fmt": "raw"
                              },
                              {
                                "name": "Per Lv",
                                "val": 2,
                                "fmt": "raw"
                              }
                            ]
                          },
                          {
                            "name": "W3 Merit Shop Unlock",
                            "val": 10,
                            "fmt": "+",
                            "note": "Pts × Per Point",
                            "children": [
                              {
                                "name": "W3 Merit Points Spent",
                                "val": 5,
                                "fmt": "raw"
                              },
                              {
                                "name": "Per Point",
                                "val": 2,
                                "fmt": "raw"
                              }
                            ]
                          },
                          {
                            "name": "Checkout Takeout Achievement",
                            "val": 5,
                            "fmt": "+"
                          },
                          {
                            "name": "Lv 1 Oxygen Atom",
                            "val": 10,
                            "fmt": "+",
                            "note": "10 × min(Lv, 1)",
                            "children": [
                              {
                                "name": "Atom 7 Lv",
                                "val": 72,
                                "fmt": "raw"
                              }
                            ]
                          },
                          {
                            "name": "Sovereign Fury Relic",
                            "val": 175,
                            "fmt": "+",
                            "note": "Base × Tier",
                            "children": [
                              {
                                "name": "Artifact 21 Base",
                                "val": 25,
                                "fmt": "raw"
                              },
                              {
                                "name": "Artifact 21 Tier",
                                "val": 7,
                                "fmt": "raw"
                              }
                            ]
                          },
                          {
                            "name": "Summoning Winner Bonus 19",
                            "val": 96.09600000000002,
                            "fmt": "+",
                            "note": "Raw × Higher Bonus × Winner Multi",
                            "children": [
                              {
                                "name": "Summoning Battles",
                                "val": 14,
                                "fmt": "raw",
                                "note": "4 raw × 3.5× Base = 14.00  →  then × 1.95× Higher Bonus × 3.02× Winner = 82.45",
                                "children": [
                                  {
                                    "name": "Cyan",
                                    "val": 10.5,
                                    "fmt": "+",
                                    "note": "Σ Cyan (W6) battles (post-Base Multi)",
                                    "children": [
                                      {
                                        "name": "Battle 14",
                                        "val": 10.5,
                                        "fmt": "raw",
                                        "note": "1 kill × 3 per kill × 3.5 base = 10.5"
                                      }
                                    ]
                                  },
                                  {
                                    "name": "Teal",
                                    "val": 3.5,
                                    "fmt": "+",
                                    "note": "Σ Teal (W7) battles (post-Base Multi)",
                                    "children": [
                                      {
                                        "name": "Battle 9",
                                        "val": 3.5,
                                        "fmt": "raw",
                                        "note": "1 kill × 1 per kill × 3.5 base = 3.5"
                                      }
                                    ]
                                  }
                                ]
                              },
                              {
                                "name": "Higher Bonus Multi",
                                "val": 1.9500000000000002,
                                "fmt": "x",
                                "note": "Pristine × Gem — the upgrade-lane multi",
                                "children": [
                                  {
                                    "name": "Crystal Comb Pristine Charm",
                                    "val": 1.3,
                                    "fmt": "x",
                                    "note": "1 + lv/100",
                                    "children": [
                                      {
                                        "name": "Pristine 8 Bonus",
                                        "val": 30,
                                        "fmt": "raw"
                                      }
                                    ]
                                  },
                                  {
                                    "name": "Gem Shop Multi",
                                    "val": 1.5,
                                    "fmt": "x",
                                    "note": "1 + 10×lv/100",
                                    "children": [
                                      {
                                        "name": "Gem Items 11",
                                        "val": 5,
                                        "fmt": "raw"
                                      }
                                    ]
                                  }
                                ]
                              },
                              {
                                "name": "Winner Multi (combined)",
                                "val": 3.52,
                                "fmt": "x",
                                "note": "1 + Σ winner sources / 100",
                                "children": [
                                  {
                                    "name": "Sovereign Winz Lantern",
                                    "val": 175,
                                    "fmt": "+",
                                    "children": [
                                      {
                                        "name": "Artifact 32 Base",
                                        "val": 25,
                                        "fmt": "raw"
                                      },
                                      {
                                        "name": "Artifact 32 Tier",
                                        "val": 7,
                                        "fmt": "raw"
                                      }
                                    ]
                                  },
                                  {
                                    "name": "W6 Merit Shop (Task)",
                                    "val": 10,
                                    "fmt": "+"
                                  },
                                  {
                                    "name": "Regalis Achievement (379)",
                                    "val": 1,
                                    "fmt": "+"
                                  },
                                  {
                                    "name": "Spectre Stars Achievement (373)",
                                    "val": 1,
                                    "fmt": "+"
                                  },
                                  {
                                    "name": "Godshard Set",
                                    "val": 15,
                                    "fmt": "+"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "name": "Bonus Levels",
                    "val": 289,
                    "fmt": "+",
                    "note": "Σ ATL (unbuffed FB68, excl. super)"
                  },
                  {
                    "name": "Super Levels",
                    "val": 125,
                    "fmt": "+",
                    "note": "Spelunk super talent (separated)"
                  }
                ]
              }
            ]
          },
          {
            "name": "Rift Slug (Companion 1)",
            "val": 35,
            "fmt": "raw",
            "children": [
              {
                "name": "Owned",
                "val": 1,
                "fmt": "raw"
              },
              {
                "name": "Bonus",
                "val": 35,
                "fmt": "raw"
              }
            ]
          },
          {
            "name": "Divinity Minor 2 (Arctis)",
            "val": 88,
            "fmt": "raw",
            "children": [
              {
                "name": "Divinity Lv",
                "val": 1050,
                "fmt": "raw"
              },
              {
                "name": "Bubble Y2 Active",
                "val": 1.4999285814611758,
                "fmt": "raw",
                "note": "0 unless BIG_P is equipped or Sheepie owned; Prisma included"
              },
              {
                "name": "Coral Kid 3",
                "val": 310,
                "fmt": "raw",
                "note": "OLA[430]"
              },
              {
                "name": "God Minor X1(2)",
                "val": 15,
                "fmt": "raw",
                "note": "GodsInfo[2][3] constant"
              }
            ]
          },
          {
            "name": "Equinox Symbols (Dream 10)",
            "val": 70,
            "fmt": "raw",
            "children": [
              {
                "name": "Base Max",
                "val": 5,
                "fmt": "raw",
                "note": "DreamUpg[10][2] game constant"
              },
              {
                "name": "Summoning WinBonus 24",
                "val": 51,
                "fmt": "raw",
                "note": "slot 24 is RAW (no multiplicative chain)",
                "children": [
                  {
                    "name": "Normal Wins Bonus",
                    "val": 0,
                    "fmt": "raw",
                    "note": "Σ slot-24 contributions from owned summoning units"
                  },
                  {
                    "name": "Endless Wins Bonus",
                    "val": 51,
                    "fmt": "raw",
                    "note": "floor(wins/40) × perCycle + partial cycle",
                    "children": [
                      {
                        "name": "Endless Wins Count",
                        "val": 407,
                        "fmt": "raw",
                        "note": "OLA[319] — total endless summoning victories"
                      },
                      {
                        "name": "Per 40-Cycle Bonus",
                        "val": 5,
                        "fmt": "raw",
                        "note": "slot-24 contribution per 40-win cycle (game constant)"
                      }
                    ]
                  }
                ]
              },
              {
                "name": "SuperBit 35 (×10)",
                "val": 10,
                "fmt": "raw",
                "note": "Gaming SuperBitType 35 unlocked? × 10"
              },
              {
                "name": "Cloud 30 (×4)",
                "val": 4,
                "fmt": "raw",
                "note": "Dream Challenge 30 completed? × 4"
              }
            ]
          },
          {
            "name": "Sneaking Completions",
            "val": 5,
            "fmt": "raw",
            "note": "raw=9"
          },
          {
            "name": "Skull of Major Talent (Grimoire 39)",
            "val": 30,
            "fmt": "raw"
          },
          {
            "name": "Kattlekruk Set",
            "val": 5,
            "fmt": "raw"
          },
          {
            "name": "Universe Talent",
            "val": 5,
            "fmt": "raw",
            "note": "Tesseract (Arcane Cultist) — +1 talent LV per level, cap 5"
          },
          {
            "name": "Super Bit 47 Lv Bonus",
            "val": 15,
            "fmt": "raw",
            "note": "max(0, floor((Lv − 500)/100))",
            "children": [
              {
                "name": "Player Lv",
                "val": 2056,
                "fmt": "raw",
                "note": "Lv0[0]"
              }
            ]
          }
        ]
      },
      {
        "name": "Super Levels",
        "val": 125,
        "fmt": "+",
        "note": "Spelunk Super Talent — active on this preset",
        "children": [
          {
            "name": "Active",
            "val": 1,
            "fmt": "raw"
          },
          {
            "name": "Base",
            "val": 50,
            "fmt": "raw"
          },
          {
            "name": "Super Duper Talents (Yellow 2)",
            "val": 50,
            "fmt": "raw",
            "note": "+10 super levels per level",
            "children": [
              {
                "name": "Base",
                "val": 10,
                "fmt": "raw"
              },
              {
                "name": "Level",
                "val": 5,
                "fmt": "raw",
                "note": "Zenith Market — Spelunk[18][7] (max 5)"
              }
            ]
          },
          {
            "name": "Zenith Super Dupers",
            "val": 25,
            "fmt": "raw",
            "note": "+1 super level per level",
            "children": [
              {
                "name": "Level",
                "val": 25,
                "fmt": "raw",
                "note": "Zenith Market — Spelunk[45][5] (max 25)"
              },
              {
                "name": "Per Lv",
                "val": 1,
                "fmt": "raw"
              }
            ]
          }
        ]
      }
    ]
  }
};

/** Pick the hypothetical-max Effective Level tree for a class key —
 *  the per-class override when one exists, else the non-ES default. */
export function hypoTreeForClass(classKey: string | null): ArkhNode {
  return (classKey && HYPO_TREE_OVERRIDES[classKey]) || HYPO_DEFAULT_TREE;
}

// Absolute ceiling per STAR talent (skill index 615–658) = the highest
// SkillLevelsMAX any scanned top player reached. The save's own SM is just
// the CURRENT unlocked cap (e.g. a dungeon talent reads 96/96 until the
// dungeon unlocks more); the most-progressed players have hit the hard
// ceiling, so this is the true 'Max' the /talents page should show.
// (641–647 are excluded by the page — their ceiling is the account's own
// maxBookLv, not a global value.)
export const STAR_TALENT_CEILING: Readonly<Record<number, number>> = {
  "615": 100,
  "616": 50,
  "617": 150,
  "618": 100,
  "619": 100,
  "620": 50,
  "621": 204,
  "622": 100,
  "623": 100,
  "624": 50,
  "626": 40,
  "627": 50,
  "628": 100,
  "629": 100,
  "630": 50,
  "631": 100,
  "632": 100,
  "633": 101,
  "634": 50,
  "635": 100,
  "636": 101,
  "637": 101,
  "638": 101,
  "639": 100,
  "640": 101,
  "641": 440,
  "642": 441,
  "643": 439,
  "644": 440,
  "645": 439,
  "646": 441,
  "647": 439,
  "649": 200,
  "650": 200,
  "651": 100,
  "652": 300,
  "653": 200,
  "654": 150,
  "655": 100,
  "656": 200,
  "657": 100,
  "658": 235
};
