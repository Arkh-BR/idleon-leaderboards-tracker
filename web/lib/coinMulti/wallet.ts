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
