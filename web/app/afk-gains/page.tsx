import type { Metadata } from "next";
import AfkGainsPageClient from "./AfkGainsPageClient";

export const metadata: Metadata = {
  title: "AFK Gains Tracker",
  description:
    "Your Idleon fighting AFK gains rate, source by source, computed from your save — per character and map, with snapshots and a top-player comparison. Everything stays in your browser.",
};

export default function AfkGainsPage() {
  return <AfkGainsPageClient />;
}
