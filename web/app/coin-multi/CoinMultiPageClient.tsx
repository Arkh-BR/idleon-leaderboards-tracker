"use client";

import StatPageClient from "@/components/statTracker/StatPageClient";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";

export default function CoinMultiPageClient() {
  return <StatPageClient config={COIN_PAGE} />;
}
