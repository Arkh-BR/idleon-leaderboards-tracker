"use client";

import StatPageClient from "@/components/statTracker/StatPageClient";
import CoinTracker from "@/components/coinMulti/CoinTracker";
import type { StatCalculatorState } from "@/components/statTracker/StatCalculator";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";

const coinTabs = (s: StatCalculatorState | null) => [
  {
    id: "coin-tracker",
    label: "💰 Coin Tracker",
    title: "How many coins each character is holding",
    render: () => <CoinTracker save={s?.save ?? null} />,
  },
];

export default function CoinMultiPageClient() {
  return <StatPageClient config={COIN_PAGE} extraTabs={coinTabs} />;
}
