import type { Metadata } from "next";
import MultikillPageClient from "./MultikillPageClient";

export const metadata: Metadata = {
  title: "Multikill Tracker",
  description:
    "Your Idleon AFK multikill, source by source, computed from your save — base, damage tier and per-tier sources, per character and map, with snapshots and a top-player comparison. Everything stays in your browser.",
};

export default function MultikillPage() {
  return <MultikillPageClient />;
}
