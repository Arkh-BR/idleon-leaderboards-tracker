import { describe, expect, it } from "vitest";
import { coinStacks, coinWallet } from "@/lib/coinMulti/wallet";

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

describe("coinStacks", () => {
  const show = (v: number) => coinStacks(v).map((s) => `${s.qty}c${s.tier}`).join(" ");
  it("follows the game's 2-digit tiers and 5-tier window", () => {
    expect(show(0)).toBe("0c1");
    expect(show(1234567)).toBe("1c4 23c3 45c2 67c1");
    expect(show(5e10)).toBe("5c6"); // > 1E10: window jumps to Coins6–10
    expect(show(1203040506070809)).toBe("12c8 3c7 4c6");
  });
  it("lets Coins25 grow past 99", () => {
    expect(coinStacks(3.41e58)[0]).toEqual({ tier: 25, qty: 34100000000 });
    expect(coinStacks(3.41e58).map((s) => s.tier)).toEqual([25, 24, 23, 22, 21]);
  });
});
