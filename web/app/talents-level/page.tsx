import type { Metadata } from "next";
import TalentsLevelPageClient from "./TalentsLevelPageClient";

export const metadata: Metadata = {
  title: "Talents",
  description:
    "Inspect a talent's Effective Level breakdown (points invested vs Max Book Lv Cap plus the full bonus chain), and scan the whole account for talents with points still to invest or caps that still need books.",
};

export default function TalentsLevelPage() {
  return <TalentsLevelPageClient />;
}
