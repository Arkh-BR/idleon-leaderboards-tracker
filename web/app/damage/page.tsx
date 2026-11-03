import type { Metadata } from "next";
import DamagePageClient from "./DamagePageClient";

export const metadata: Metadata = {
  title: "Damage Tracker",
  description:
    "Your Idleon damage (Min ~ Max), source by source, computed from your save — base damage, damage % and multipliers, per character and map, with snapshots and a top-player comparison. Everything stays in your browser.",
};

export default function DamagePage() {
  return <DamagePageClient />;
}
