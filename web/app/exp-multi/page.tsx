import type { Metadata } from "next";
import ExpMultiPageClient from "./ExpMultiPageClient";

export const metadata: Metadata = {
  title: "EXP Multi Tracker",
  description:
    "Your Idleon Class EXP multiplier, source by source, computed from your save — per character and map, with snapshots and a top-player comparison. Everything stays in your browser.",
};

export default function ExpMultiPage() {
  return <ExpMultiPageClient />;
}
