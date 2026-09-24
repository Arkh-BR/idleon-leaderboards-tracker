"use client";

import StatPageClient from "@/components/statTracker/StatPageClient";
import { EXP_PAGE } from "@/lib/expMulti/pageConfig";

// The config holds functions, so it's built on the client side of the page.
export default function ExpMultiPageClient() {
  return <StatPageClient config={EXP_PAGE} />;
}
