import { describe, expect, it } from "vitest";
import { coinWallet } from "@/lib/coinMulti/wallet";

describe("coinWallet", () => {
  it("lists each character's Money_N richest first, plus the bank", () => {
    const save = {
      charNames: ["A", "B", "C"],
      data: {
        PVStatList_0: [1, 1, 1, 1, 1],
        PVStatList_1: [1, 1, 1, 1, 1],
        PVStatList_2: [1, 1, 1, 1, 1],
        Money_0: 5,
        Money_1: 2e57,
        MoneyBANK: 100,
      },
    };
    const w = coinWallet(save);
    expect(w.chars.map((c) => [c.charName, c.coins])).toEqual([["B", 2e57], ["A", 5], ["C", 0]]);
    expect(w.bank).toBe(100);
    expect(w.total).toBe(2e57 + 105);
  });
});
