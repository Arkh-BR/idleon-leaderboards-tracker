"use client";

import StatPageClient from "@/components/statTracker/StatPageClient";
import { AFK_PAGE } from "@/lib/afkGains/pageConfig";

// The config holds functions, so it's built on the client side of the page.
export default function AfkGainsPageClient() {
  return <StatPageClient config={AFK_PAGE} />;
}
