import type { Metadata } from "next";
import TomePageClient from "./TomePageClient";

export const metadata: Metadata = {
  title: "Tome Score Tracker",
  description:
    "Paste your raw save JSON from IdleonToolbox and compute all 118 tome task points locally — nothing leaves your browser.",
};

export default function TomePage() {
  return <TomePageClient />;
}
