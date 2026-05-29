// Hypothetical-max Effective Level tree (full depth) — the best value of
// every node across the scanned top players, computed on the Health
// Booster (a plain simple talent, so its Effective Level subtree is the
// template every simple talent shares). Effective Level = best base +
// bonus + super. Rendered as-is by the /talents Hypothetical tab.
// Auto-refreshed by scripts/update-top-talents.ts.
//
// Snapshot generated: 2026-05-29T12:51:12.043Z
// Players scanned: 70

import type { CorganNode } from "../corgan/node";

export const HYPO_TALENTS_GENERATED_AT = "2026-05-29T12:51:12.043Z";
export const HYPO_TALENTS_PLAYERS_SCANNED = 70;

export const HYPO_EFFECTIVE_TREE: CorganNode = {
  "name": "Effective Level",
  "val": 769,
  "children": [
    {
      "name": "Base Level",
      "val": 396,
      "children": [
        {
          "name": "Points Invested",
          "val": 396,
          "fmt": "raw",
          "note": "actual save — owner: Dragami"
        },
        {
          "name": "Max Book Lv Cap",
          "val": 396,
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
              ],
              "fmt": "+"
            },
            {
              "name": "W3 Merit Shop Unlock",
              "val": 10,
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
              ],
              "fmt": "+"
            },
            {
              "name": "Checkout Takeout Achievement",
              "val": 5,
              "fmt": "+"
            },
            {
              "name": "Lv 1 Oxygen Atom",
              "val": 10,
              "children": [
                {
                  "name": "Atom 7 Lv",
                  "val": 70,
                  "fmt": "raw"
                }
              ],
              "fmt": "+"
            },
            {
              "name": "Sovereign Fury Relic",
              "val": 150,
              "children": [
                {
                  "name": "Artifact 21 Base",
                  "val": 25,
                  "fmt": "raw"
                },
                {
                  "name": "Artifact 21 Tier",
                  "val": 6,
                  "fmt": "raw"
                }
              ],
              "fmt": "+"
            },
            {
              "name": "Summoning Winner Bonus 19",
              "val": 75.621,
              "children": [
                {
                  "name": "Summoning Battles",
                  "val": 14,
                  "children": [
                    {
                      "name": "Cyan",
                      "val": 10.5,
                      "children": [
                        {
                          "name": "Battle 14",
                          "val": 10.5,
                          "fmt": "raw",
                          "note": "1 kill × 3 per kill × 3.5 base = 10.5"
                        }
                      ],
                      "fmt": "+",
                      "note": "Σ Cyan (W6) battles (post-Base Multi)"
                    },
                    {
                      "name": "Teal",
                      "val": 3.5,
                      "children": [
                        {
                          "name": "Battle 9",
                          "val": 3.5,
                          "fmt": "raw",
                          "note": "1 kill × 1 per kill × 3.5 base = 3.5"
                        }
                      ],
                      "fmt": "+",
                      "note": "Σ Teal (W7) battles (post-Base Multi)"
                    }
                  ],
                  "fmt": "raw",
                  "note": "4 raw × 3.5× Base = 14.00  →  then × 1.95× Higher Bonus × 2.77× Winner = 75.62"
                },
                {
                  "name": "Higher Bonus Multi",
                  "val": 1.9500000000000002,
                  "children": [
                    {
                      "name": "Crystal Comb Pristine Charm",
                      "val": 1.3,
                      "children": [
                        {
                          "name": "Pristine 8 Bonus",
                          "val": 30,
                          "fmt": "raw"
                        }
                      ],
                      "fmt": "x",
                      "note": "1 + lv/100"
                    },
                    {
                      "name": "Gem Shop Multi",
                      "val": 1.5,
                      "children": [
                        {
                          "name": "Gem Items 11",
                          "val": 5,
                          "fmt": "raw"
                        }
                      ],
                      "fmt": "x",
                      "note": "1 + 10×lv/100"
                    }
                  ],
                  "fmt": "x",
                  "note": "Pristine × Gem — the upgrade-lane multi"
                },
                {
                  "name": "Winner Multi (combined)",
                  "val": 2.77,
                  "children": [
                    {
                      "name": "Sovereign Winz Lantern",
                      "val": 150,
                      "children": [
                        {
                          "name": "Artifact 32 Base",
                          "val": 25,
                          "fmt": "raw"
                        },
                        {
                          "name": "Artifact 32 Tier",
                          "val": 6,
                          "fmt": "raw"
                        }
                      ],
                      "fmt": "+"
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
                  ],
                  "fmt": "x",
                  "note": "1 + Σ winner sources / 100"
                }
              ],
              "fmt": "+"
            }
          ],
          "fmt": "raw",
          "note": "N.js maxBookLv"
        }
      ],
      "fmt": "raw",
      "note": "min(invested, cap) — owner: Dragami"
    },
    {
      "name": "Bonus Levels",
      "val": 248,
      "children": [
        {
          "name": "Symbols of Beyond ~R (Talent 149)",
          "val": 20,
          "children": [
            {
              "name": "Base Level",
              "val": 396,
              "children": [
                {
                  "name": "Points Invested",
                  "val": 396,
                  "fmt": "raw",
                  "note": "actual save — owner: Dragami"
                },
                {
                  "name": "Max Book Lv Cap",
                  "val": 396,
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
                      ],
                      "fmt": "+"
                    },
                    {
                      "name": "W3 Merit Shop Unlock",
                      "val": 10,
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
                      ],
                      "fmt": "+"
                    },
                    {
                      "name": "Checkout Takeout Achievement",
                      "val": 5,
                      "fmt": "+"
                    },
                    {
                      "name": "Lv 1 Oxygen Atom",
                      "val": 10,
                      "children": [
                        {
                          "name": "Atom 7 Lv",
                          "val": 70,
                          "fmt": "raw"
                        }
                      ],
                      "fmt": "+"
                    },
                    {
                      "name": "Sovereign Fury Relic",
                      "val": 150,
                      "children": [
                        {
                          "name": "Artifact 21 Base",
                          "val": 25,
                          "fmt": "raw"
                        },
                        {
                          "name": "Artifact 21 Tier",
                          "val": 6,
                          "fmt": "raw"
                        }
                      ],
                      "fmt": "+"
                    },
                    {
                      "name": "Summoning Winner Bonus 19",
                      "val": 75.621,
                      "children": [
                        {
                          "name": "Summoning Battles",
                          "val": 14,
                          "children": [
                            {
                              "name": "Cyan",
                              "val": 10.5,
                              "children": [
                                {
                                  "name": "Battle 14",
                                  "val": 10.5,
                                  "fmt": "raw",
                                  "note": "1 kill × 3 per kill × 3.5 base = 10.5"
                                }
                              ],
                              "fmt": "+",
                              "note": "Σ Cyan (W6) battles (post-Base Multi)"
                            },
                            {
                              "name": "Teal",
                              "val": 3.5,
                              "children": [
                                {
                                  "name": "Battle 9",
                                  "val": 3.5,
                                  "fmt": "raw",
                                  "note": "1 kill × 1 per kill × 3.5 base = 3.5"
                                }
                              ],
                              "fmt": "+",
                              "note": "Σ Teal (W7) battles (post-Base Multi)"
                            }
                          ],
                          "fmt": "raw",
                          "note": "4 raw × 3.5× Base = 14.00  →  then × 1.95× Higher Bonus × 2.77× Winner = 75.62"
                        },
                        {
                          "name": "Higher Bonus Multi",
                          "val": 1.9500000000000002,
                          "children": [
                            {
                              "name": "Crystal Comb Pristine Charm",
                              "val": 1.3,
                              "children": [
                                {
                                  "name": "Pristine 8 Bonus",
                                  "val": 30,
                                  "fmt": "raw"
                                }
                              ],
                              "fmt": "x",
                              "note": "1 + lv/100"
                            },
                            {
                              "name": "Gem Shop Multi",
                              "val": 1.5,
                              "children": [
                                {
                                  "name": "Gem Items 11",
                                  "val": 5,
                                  "fmt": "raw"
                                }
                              ],
                              "fmt": "x",
                              "note": "1 + 10×lv/100"
                            }
                          ],
                          "fmt": "x",
                          "note": "Pristine × Gem — the upgrade-lane multi"
                        },
                        {
                          "name": "Winner Multi (combined)",
                          "val": 2.77,
                          "children": [
                            {
                              "name": "Sovereign Winz Lantern",
                              "val": 150,
                              "children": [
                                {
                                  "name": "Artifact 32 Base",
                                  "val": 25,
                                  "fmt": "raw"
                                },
                                {
                                  "name": "Artifact 32 Tier",
                                  "val": 6,
                                  "fmt": "raw"
                                }
                              ],
                              "fmt": "+"
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
                          ],
                          "fmt": "x",
                          "note": "1 + Σ winner sources / 100"
                        }
                      ],
                      "fmt": "+"
                    }
                  ],
                  "fmt": "raw",
                  "note": "N.js maxBookLv"
                }
              ],
              "fmt": "raw",
              "note": "min(invested, cap) — owner: Dragami"
            }
          ],
          "fmt": "raw",
          "note": "intervalAdd(1,20,396)"
        },
        {
          "name": "Maroon Warship (Achievement 291)",
          "val": 1,
          "fmt": "raw"
        },
        {
          "name": "Family Bonus 68 (Mage)",
          "val": 16,
          "children": [
            {
              "name": "Best Mage Lv",
              "val": 1723,
              "children": [
                {
                  "name": "Char 5 Lv",
                  "val": 1723,
                  "fmt": "raw",
                  "note": "Dragamino — elemental sorcerer (cls 34)"
                }
              ],
              "fmt": "raw",
              "note": "max across account — 1 mage char"
            },
            {
              "name": "Family Guy Multi (×) — potential buff",
              "val": 1.3539170506912444,
              "children": [
                {
                  "name": "Base Level",
                  "val": 396,
                  "children": [
                    {
                      "name": "Points Invested",
                      "val": 396,
                      "fmt": "raw",
                      "note": "save=396"
                    },
                    {
                      "name": "Max Book Lv Cap",
                      "val": 396,
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
                          ],
                          "fmt": "+",
                          "note": "Lv × Per Lv"
                        },
                        {
                          "name": "W3 Merit Shop Unlock",
                          "val": 10,
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
                          ],
                          "fmt": "+",
                          "note": "Pts × Per Point"
                        },
                        {
                          "name": "Checkout Takeout Achievement",
                          "val": 5,
                          "fmt": "+"
                        },
                        {
                          "name": "Lv 1 Oxygen Atom",
                          "val": 10,
                          "children": [
                            {
                              "name": "Atom 7 Lv",
                              "val": 70,
                              "fmt": "raw"
                            }
                          ],
                          "fmt": "+",
                          "note": "10 × min(Lv, 1)"
                        },
                        {
                          "name": "Sovereign Fury Relic",
                          "val": 150,
                          "children": [
                            {
                              "name": "Artifact 21 Base",
                              "val": 25,
                              "fmt": "raw"
                            },
                            {
                              "name": "Artifact 21 Tier",
                              "val": 6,
                              "fmt": "raw"
                            }
                          ],
                          "fmt": "+",
                          "note": "Base × Tier"
                        },
                        {
                          "name": "Summoning Winner Bonus 19",
                          "val": 75.621,
                          "children": [
                            {
                              "name": "Summoning Battles",
                              "val": 14,
                              "children": [
                                {
                                  "name": "Cyan",
                                  "val": 10.5,
                                  "children": [
                                    {
                                      "name": "Battle 14",
                                      "val": 10.5,
                                      "fmt": "raw",
                                      "note": "1 kill × 3 per kill × 3.5 base = 10.5"
                                    }
                                  ],
                                  "fmt": "+",
                                  "note": "Σ Cyan (W6) battles (post-Base Multi)"
                                },
                                {
                                  "name": "Teal",
                                  "val": 3.5,
                                  "children": [
                                    {
                                      "name": "Battle 9",
                                      "val": 3.5,
                                      "fmt": "raw",
                                      "note": "1 kill × 1 per kill × 3.5 base = 3.5"
                                    }
                                  ],
                                  "fmt": "+",
                                  "note": "Σ Teal (W7) battles (post-Base Multi)"
                                }
                              ],
                              "fmt": "raw",
                              "note": "4 raw × 3.5× Base = 14.00  →  then × 1.95× Higher Bonus × 2.77× Winner = 75.62"
                            },
                            {
                              "name": "Higher Bonus Multi",
                              "val": 1.9500000000000002,
                              "children": [
                                {
                                  "name": "Crystal Comb Pristine Charm",
                                  "val": 1.3,
                                  "children": [
                                    {
                                      "name": "Pristine 8 Bonus",
                                      "val": 30,
                                      "fmt": "raw"
                                    }
                                  ],
                                  "fmt": "x",
                                  "note": "1 + lv/100"
                                },
                                {
                                  "name": "Gem Shop Multi",
                                  "val": 1.5,
                                  "children": [
                                    {
                                      "name": "Gem Items 11",
                                      "val": 5,
                                      "fmt": "raw"
                                    }
                                  ],
                                  "fmt": "x",
                                  "note": "1 + 10×lv/100"
                                }
                              ],
                              "fmt": "x",
                              "note": "Pristine × Gem — the upgrade-lane multi"
                            },
                            {
                              "name": "Winner Multi (combined)",
                              "val": 2.77,
                              "children": [
                                {
                                  "name": "Sovereign Winz Lantern",
                                  "val": 150,
                                  "children": [
                                    {
                                      "name": "Artifact 32 Base",
                                      "val": 25,
                                      "fmt": "raw"
                                    },
                                    {
                                      "name": "Artifact 32 Tier",
                                      "val": 6,
                                      "fmt": "raw"
                                    }
                                  ],
                                  "fmt": "+"
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
                              ],
                              "fmt": "x",
                              "note": "1 + Σ winner sources / 100"
                            }
                          ],
                          "fmt": "+",
                          "note": "Raw × Higher Bonus × Winner Multi"
                        }
                      ],
                      "fmt": "raw",
                      "note": "N.js maxBookLv"
                    }
                  ],
                  "fmt": "raw",
                  "note": "min(invested, cap)"
                },
                {
                  "name": "Bonus Levels",
                  "val": 248,
                  "fmt": "+",
                  "note": "Σ ATL (unbuffed FB68, excl. super)"
                }
              ],
              "fmt": "raw",
              "note": "1 + decay(x1, x2, Base+Bonus)/100"
            }
          ],
          "fmt": "raw",
          "note": "floor(decay × Family Guy Multi if active)"
        },
        {
          "name": "Rift Slug (Companion 1)",
          "val": 25,
          "children": [
            {
              "name": "Owned",
              "val": 1,
              "fmt": "raw"
            },
            {
              "name": "Bonus",
              "val": 25,
              "fmt": "raw"
            }
          ],
          "fmt": "raw"
        },
        {
          "name": "Divinity Minor 2 (Arctis)",
          "val": 64,
          "children": [
            {
              "name": "Divinity Lv",
              "val": 848,
              "fmt": "raw"
            },
            {
              "name": "Bubble Y2 Active",
              "val": 1.4998802615088647,
              "fmt": "raw",
              "note": "0 if Y2 bubble not equipped & no all-bubbles flag"
            },
            {
              "name": "Coral Kid 3",
              "val": 205,
              "fmt": "raw",
              "note": "OLA[430]"
            },
            {
              "name": "God Minor X1(2)",
              "val": 15,
              "fmt": "raw",
              "note": "GodsInfo[2][3] constant"
            }
          ],
          "fmt": "raw"
        },
        {
          "name": "Equinox Symbols (Dream 10)",
          "val": 68,
          "children": [
            {
              "name": "Base Max",
              "val": 5,
              "fmt": "raw",
              "note": "DreamUpg[10][2] game constant"
            },
            {
              "name": "Summoning WinBonus 24",
              "val": 49,
              "children": [
                {
                  "name": "Normal Wins Bonus",
                  "val": 0,
                  "fmt": "raw",
                  "note": "Σ slot-24 contributions from owned summoning units"
                },
                {
                  "name": "Endless Wins Bonus",
                  "val": 49,
                  "children": [
                    {
                      "name": "Endless Wins Count",
                      "val": 389,
                      "fmt": "raw",
                      "note": "OLA[319] — total endless summoning victories"
                    },
                    {
                      "name": "Per 40-Cycle Bonus",
                      "val": 5,
                      "fmt": "raw",
                      "note": "slot-24 contribution per 40-win cycle (game constant)"
                    }
                  ],
                  "fmt": "raw",
                  "note": "floor(wins/40) × perCycle + partial cycle"
                }
              ],
              "fmt": "raw",
              "note": "slot 24 is RAW (no multiplicative chain)"
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
          ],
          "fmt": "raw"
        },
        {
          "name": "Sneaking Completions",
          "val": 5,
          "fmt": "raw",
          "note": "raw=8"
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
          "val": 13,
          "children": [
            {
              "name": "Player Lv",
              "val": 1818,
              "fmt": "raw",
              "note": "Lv0[0]"
            }
          ],
          "fmt": "raw",
          "note": "max(0, floor((Lv − 500)/100))"
        }
      ],
      "fmt": "+"
    },
    {
      "name": "Super Levels",
      "val": 125,
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
          ],
          "fmt": "raw",
          "note": "+10 super levels per level"
        },
        {
          "name": "Zenith Super Dupers",
          "val": 25,
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
          ],
          "fmt": "raw",
          "note": "+1 super level per level"
        }
      ],
      "fmt": "+",
      "note": "Spelunk Super Talent — active on this preset"
    }
  ],
  "fmt": "raw",
  "note": "Base + Bonus + Super"
};
