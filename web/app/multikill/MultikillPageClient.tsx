"use client";

import StatPageClient from "@/components/statTracker/StatPageClient";
import { MULTIKILL_PAGE } from "@/lib/multikill/pageConfig";

// The config holds functions, so it's built on the client side of the page.
export default function MultikillPageClient() {
  return <StatPageClient config={MULTIKILL_PAGE} />;
}
