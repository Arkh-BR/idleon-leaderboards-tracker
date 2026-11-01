import type { Metadata } from "next";
import ArtifactFindPageClient from "./ArtifactFindPageClient";

export const metadata: Metadata = {
  title: "Artifact Find Tracker",
  description:
    "Your Idleon Sailing Artifact Find multiplier, source by source, computed from your save — per character, with snapshots and a top-player comparison. Everything stays in your browser.",
};

export default function ArtifactFindPage() {
  return <ArtifactFindPageClient />;
}
