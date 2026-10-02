"use client";

import { useMemo } from "react";
import Num from "@/components/Num";
import { coinWallet } from "@/lib/coinMulti/wallet";

/** Coins per character (and in the storage bank), richest first. */
export default function CoinTracker({ save }: { save: any }) {
  const wallet = useMemo(() => (save ? coinWallet(save) : null), [save]);
  if (!wallet) return <p className="text-sm text-zinc-500 text-center py-10">Load a save above to see your coins.</p>;

  const rows = [
    ...wallet.chars.map((c) => ({ key: `c${c.charIndex}`, name: c.charName, coins: c.coins })),
    ...(wallet.bank > 0 ? [{ key: "bank", name: "🏦 Storage bank", coins: wallet.bank }] : []),
  ].sort((a, b) => b.coins - a.coins);
  const top = rows[0]?.coins || 1;
  const pct = (v: number) => (wallet.total > 0 ? (100 * v) / wallet.total : 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-zinc-500 text-left">
            <th className="py-1.5 pr-2 font-medium">Character</th>
            <th className="py-1.5 px-2 font-medium text-right">Coins</th>
            <th className="py-1.5 pl-2 font-medium w-2/5">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-zinc-800">
              <td className="py-1.5 pr-2 text-sky-300 truncate max-w-[10rem]">{r.name}</td>
              <td className="py-1.5 px-2 text-right text-gold">
                <Num value={r.coins} />
              </td>
              <td className="py-1.5 pl-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 grow rounded bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${(100 * r.coins) / top}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 w-12 text-right">{pct(r.coins).toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-zinc-700 font-semibold">
            <td className="py-1.5 pr-2 text-zinc-300">Total</td>
            <td className="py-1.5 px-2 text-right text-gold">
              <Num value={wallet.total} />
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
