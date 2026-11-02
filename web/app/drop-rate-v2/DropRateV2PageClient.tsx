"use client";

import StatPageClient from "@/components/statTracker/StatPageClient";
import { DR2_PAGE } from "@/lib/dropRateV2/pageConfig";

// The config holds functions, so it's built on the client side of the page.
export default function DropRateV2PageClient() {
  return <StatPageClient config={DR2_PAGE} />;
}
