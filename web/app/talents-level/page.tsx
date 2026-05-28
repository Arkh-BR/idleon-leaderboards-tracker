import type { Metadata } from "next";
import TalentsLevelPageClient from "./TalentsLevelPageClient";

export const metadata: Metadata = {
  title: "Talents Level",
  description:
    "Inspect a single talent's Effective Level breakdown — Base Level (points invested vs Max Book Lv Cap) plus the full chain of bonus levels. Paste a raw save JSON and pick the talent to observe.",
};

export default function TalentsLevelPage() {
  return <TalentsLevelPageClient />;
}
