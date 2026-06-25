// web/__tests__/components/talentsLevel/biggestGainsShell.test.tsx
//
// Green-guard for IDL-21 — harmonizing the Talents prescriptive tabs to the
// "💡 Biggest Gains" shell (M2 account-wide checklist). These cover the S5
// account-wide "everything at cap" emerald copy (spec §3.6 variant M2) for the
// two checklist views. The 3 tab labels live inside an inline extraTabs array
// in TalentsLevelPageClient (heavy page-level deps) and are verified via
// grep + tsc instead of a brittle full-page render.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import TalentsToMaxView from "@/components/talentsLevel/TalentsToMaxView";
import UnbookedView from "@/components/talentsLevel/UnbookedView";

describe("Talents Biggest Gains shell — S5 account-wide copy", () => {
  it("TalentsToMaxView shows the canonical S5 copy when nothing is below cap", () => {
    // groups=[] (non-null, empty) ⇒ totalMissing === 0 ⇒ the emerald S5 block.
    const { container } = render(
      <TalentsToMaxView groups={[]} loading={false} />
    );
    expect(container.textContent).toContain(
      "🎉 Every character is at the Max Book Lv cap — nothing to invest. Nice."
    );
  });

  it("UnbookedView shows the S5 family copy when every cap is fully booked", () => {
    // groups=[] (non-null, empty) ⇒ totalBooks === 0 ⇒ the emerald S5 block.
    // Same §3.6 M2 family (🎉 + "Every character …" + "Nice.") with the
    // domain verb "book" instead of "invest".
    const { container } = render(<UnbookedView groups={[]} loading={false} />);
    expect(container.textContent).toContain(
      "🎉 Every character is fully booked — every cap is at the Max Book Lv ceiling. Nice."
    );
  });
});
