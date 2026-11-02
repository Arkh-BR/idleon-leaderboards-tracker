import type { Metadata } from "next";
import DropRateV2PageClient from "./DropRateV2PageClient";

export const metadata: Metadata = {
  title: "Drop Rate V2 Tracker (beta)",
  description:
    "Your Idleon Drop Rate, source by source, computed from your save with the new engine (beta) — per character and map, with snapshots and a top-player comparison. Everything stays in your browser.",
};

export default function DropRateV2Page() {
  return <DropRateV2PageClient />;
}
