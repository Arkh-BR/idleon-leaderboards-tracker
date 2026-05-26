import type { Metadata } from "next";
import DropRatePageClient from "./DropRatePageClient";

export const metadata: Metadata = {
  title: "Drop Rate Tracker (WIP)",
  description:
    "Track your Idleon drop rate over time. Paste a raw save JSON, pick a character, and snapshot the value plus correlated stats — everything stays in your browser.",
};

export default function DropRatePage() {
  return <DropRatePageClient />;
}
