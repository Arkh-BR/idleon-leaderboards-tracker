"use client";

import StatPageClient from "@/components/statTracker/StatPageClient";
import { DAMAGE_PAGE } from "@/lib/damage/pageConfig";

// The config holds functions, so it's built on the client side of the page.
export default function DamagePageClient() {
  return <StatPageClient config={DAMAGE_PAGE} />;
}
