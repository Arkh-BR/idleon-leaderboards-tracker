import type { Metadata } from "next";
import CoinMultiPageClient from "./CoinMultiPageClient";

export const metadata: Metadata = {
  title: "Coin Multi Tracker",
  description:
    "Your Idleon monster coin multiplier, source by source, computed from your save — per character and map, with snapshots and a top-player comparison. Everything stays in your browser.",
};

export default function CoinMultiPage() {
  return <CoinMultiPageClient />;
}
