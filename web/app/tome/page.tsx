import type { Metadata } from "next";
import TomePageClient from "./TomePageClient";
import { TOME_TASKS } from "@/lib/tome/tasks";

export const metadata: Metadata = {
  title: "Tome Score Tracker",
  description: `Paste your raw save JSON from IdleonToolbox and compute all ${TOME_TASKS.length} tome task points locally — nothing leaves your browser.`,
};

export default function TomePage() {
  return <TomePageClient />;
}
