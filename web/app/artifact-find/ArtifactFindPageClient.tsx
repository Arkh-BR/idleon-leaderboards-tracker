"use client";

import StatPageClient from "@/components/statTracker/StatPageClient";
import { ARTIFACT_PAGE } from "@/lib/artifactFind/pageConfig";

// The config holds functions, so it's built on the client side of the page.
export default function ArtifactFindPageClient() {
  return <StatPageClient config={ARTIFACT_PAGE} />;
}
