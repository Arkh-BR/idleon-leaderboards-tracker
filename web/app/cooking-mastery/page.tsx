import type { Metadata } from "next";
import CookingMasteryPageClient from "./CookingMasteryPageClient";

export const metadata: Metadata = {
  title: "Cooking Mastery Optimizer",
  description:
    "Optimize your Idleon Cooking Mastery Purple PTS allocation to maximize Exp/h. Load a save, see the optimal split and the marginal ROI of every mastery upgrade — computed locally in your browser.",
};

export default function CookingMasteryPage() {
  return <CookingMasteryPageClient />;
}
