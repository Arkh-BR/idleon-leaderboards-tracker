import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DeepView from "@/components/dropRate/DeepView";

// The Biggest Gains tab must render its own Empty/Loading state even before a
// save is loaded (tree === null). Previously DeepView short-circuited to a
// generic placeholder when tree was null, hiding caller-supplied extra tabs.

describe("DeepView — extra tabs with no tree", () => {
  it("renders an active extra tab (and the tab strip) while tree is null", () => {
    render(
      <DeepView
        tree={null}
        extraTabsFirst
        defaultView="bg"
        extraTabs={[
          { id: "bg", label: "💡 Biggest Gains", render: () => <p>BG BODY</p> },
        ]}
      />
    );
    // Extra tab body is shown instead of the generic placeholder
    expect(screen.getByText("BG BODY")).toBeInTheDocument();
    // The tab strip is present (so the user can switch tabs)
    expect(screen.getByText("💡 Biggest Gains")).toBeInTheDocument();
    expect(screen.getByText("🌳 Tree")).toBeInTheDocument();
  });

  it("keeps the generic placeholder when there are no extra tabs (no regression)", () => {
    render(<DeepView tree={null} />);
    expect(
      screen.getByText("Load a save above to populate the deep view.")
    ).toBeInTheDocument();
    // No tab strip rendered for the bare built-in case
    expect(screen.queryByText("🌳 Tree")).not.toBeInTheDocument();
  });

  it("puts the tree toolbar after the tabs on the built-in views, once a tree is loaded", () => {
    const tabs = [{ id: "bg", label: "💡 Biggest Gains", render: () => null }];
    const toolbar = <label>TOOLBAR</label>;
    const { rerender } = render(<DeepView tree={null} extraTabs={tabs} treeToolbar={toolbar} />);
    expect(screen.queryByText("TOOLBAR")).toBeNull(); // no tree yet

    rerender(<DeepView tree={{ name: "Drop Rate", val: 2, fmt: "x", children: [] }} extraTabs={tabs} treeToolbar={toolbar} />);
    const treeTab = screen.getByRole("button", { name: "🌳 Tree" });
    expect(treeTab.parentElement!.nextElementSibling).toContainElement(screen.getByText("TOOLBAR"));

    fireEvent.click(screen.getByRole("button", { name: "💡 Biggest Gains" }));
    expect(screen.queryByText("TOOLBAR")).toBeNull(); // not on caller tabs
  });
});
