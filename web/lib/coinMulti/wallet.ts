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

/** The game's coin display (N.js inventory, MoneyBANK block): 2 digits per
 *  coin tier (Coins1 = 1, Coins2 = 100, …), at most 5 tiers on screen, the
 *  window jumping 5 tiers per ÷1E10 up to Coins21–25. Unlike the game, the
 *  top tier (Coins25) keeps counting past 99 instead of wrapping.
 *  Highest tier first. */
export function coinStacks(v: number): CoinStack[] {
  const digits = BigInt(Number.isFinite(v) && v > 0 ? Math.floor(v) : 0).toString();
  const len = digits.length;
  const bottom = 1 + 5 * Math.min(4, Math.floor((len - 1) / 10));
  const top = Math.max(bottom, Math.min(25, Math.ceil(len / 2)));
  const out: CoinStack[] = [];
  for (let t = top; t >= bottom; t--) {
    const end = len - 2 * (t - 1);
    out.push({ tier: t, qty: Number(digits.slice(t === 25 ? 0 : Math.max(0, end - 2), end)) });
  }
  return out;
}
