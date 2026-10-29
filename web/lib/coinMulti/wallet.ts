// Coin Tracker: where the account's coins sit. Each character carries its
// own `Money_N`; the storage chest's deposit is `MoneyBANK` (IT sums the
// same fields into currencies.rawMoney).

import { listCharacters } from "@/lib/dropRate/extract";

export type WalletRow = { charIndex: number; charName: string; coins: number };
export type Wallet = { chars: WalletRow[]; bank: number; total: number };

const coins = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Characters richest first, plus the bank and the account total. */
export function coinWallet(save: any): Wallet {
  const data = save?.data ?? {};
  const chars = listCharacters(save)
    .map((c) => ({ charIndex: c.charIndex, charName: c.charName, coins: coins(data[`Money_${c.charIndex}`]) }))
    .sort((a, b) => b.coins - a.coins);
  const bank = coins(data.MoneyBANK);
  return { chars, bank, total: chars.reduce((s, c) => s + c.coins, bank) };
}

export type CoinStack = { tier: number; qty: number };

// @njs _customBlock_totalcointypes
/** N.js totalcointypes(3): how many ÷1E10 window jumps the coin display
 *  makes (5 since 2026-10-16, which added Coins26–30; was 4). */
const COIN_WINDOW_JUMPS = 5;
const TOP_TIER = 5 * (COIN_WINDOW_JUMPS + 1);

/** The game's coin display (N.js inventory, MoneyBANK block): 2 digits per
 *  coin tier (Coins1 = 1, Coins2 = 100, …), at most 5 tiers on screen, the
 *  window jumping 5 tiers per ÷1E10 up to Coins26–30. Unlike the game, the
 *  top tier (Coins30) keeps counting past 99 instead of wrapping.
 *  Highest tier first. */
export function coinStacks(v: number): CoinStack[] {
  const digits = BigInt(Number.isFinite(v) && v > 0 ? Math.floor(v) : 0).toString();
  const len = digits.length;
  const bottom = 1 + 5 * Math.min(COIN_WINDOW_JUMPS, Math.floor((len - 1) / 10));
  const top = Math.max(bottom, Math.min(TOP_TIER, Math.ceil(len / 2)));
  const out: CoinStack[] = [];
  for (let t = top; t >= bottom; t--) {
    const end = len - 2 * (t - 1);
    out.push({ tier: t, qty: Number(digits.slice(t === TOP_TIER ? 0 : Math.max(0, end - 2), end)) });
  }
  return out;
}
