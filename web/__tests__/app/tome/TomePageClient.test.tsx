import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TomePageClient from "@/app/tome/TomePageClient";

describe("TomePageClient tab strip", () => {
  it("makes '💡 Biggest Gains' the first tab and the default", () => {
    render(<TomePageClient />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent(/Biggest Gains/);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("orders the tabs Biggest Gains → Best Tome → Paste your data here", () => {
    render(<TomePageClient />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      expect.stringMatching(/Biggest Gains/),
      expect.stringMatching(/Best Tome/),
      expect.stringMatching(/Paste your data here/),
    ]);
  });

  it("switches to Best Tome when its tab is clicked", () => {
    render(<TomePageClient />);
    const bestTab = screen.getByRole("tab", { name: /Best Tome/ });
    fireEvent.click(bestTab);
    expect(bestTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Biggest Gains/ })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });
});
