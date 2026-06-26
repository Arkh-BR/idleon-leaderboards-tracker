// web/__tests__/components/dropRate/deepViewFrontDoor.test.tsx
//
// Green-guard for IDL-22 — front-door promotion of the Talents prescriptive
// views. The carve-out decouples the account-wide extraTabs from the
// single-talent `tree`: a prescriptive extraTab must render even when no
// talent is selected (tree === null), satisfying AC-CO1/AC-CO3. The Drop
// Rate consumer (no extraTabs) must keep its exact "load a save" behavior
// (no regression — DeepView is shared).
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import DeepView from "@/components/dropRate/DeepView";

describe("DeepView — front-door extraTab without a tree (IDL-22)", () => {
  const extraTabs = [
    {
      id: "tomax",
      label: "💡 Biggest Gains: Points to Invest",
      render: () => <div>ACCOUNT_WIDE_CONTENT</div>,
    },
  ];

  it("renders the default extraTab even when tree is null (no talent picked)", () => {
    const { container } = render(
      <DeepView
        tree={null}
        showWorldView={false}
        extraTabs={extraTabs}
        extraTabsFirst
        defaultView="tomax"
      />
    );
    // Prescriptive account-wide view shows without requiring a selection…
    expect(container.textContent).toContain("ACCOUNT_WIDE_CONTENT");
    // …and the tab strip is present so the user can navigate.
    expect(container.textContent).toContain(
      "💡 Biggest Gains: Points to Invest"
    );
  });

  it("keeps the tree-only Drop Rate parity (no extraTabs, null tree)", () => {
    const { container } = render(<DeepView tree={null} />);
    expect(container.textContent).toContain(
      "Load a save above to populate the deep view."
    );
  });

  it("scopes a custom emptyTreeLabel to the built-in tree tab", () => {
    const { container } = render(
      <DeepView
        tree={null}
        showWorldView={false}
        extraTabs={extraTabs}
        extraTabsFirst
        defaultView="tree"
        emptyTreeLabel="Pick a talent from the grid above."
      />
    );
    // Built-in tree tab active + no tree ⇒ scoped placeholder (not a global gate)…
    expect(container.textContent).toContain(
      "Pick a talent from the grid above."
    );
    // …and the prescriptive tabs are still reachable.
    expect(container.textContent).toContain(
      "💡 Biggest Gains: Points to Invest"
    );
  });
});
