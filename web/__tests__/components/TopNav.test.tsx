import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TopNav from "@/components/TopNav";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));
// Existing tests assert the nav renders, so keep protest mode off here.
vi.mock("@/lib/protest/config", () => ({ PROTEST_MODE: false }));

describe("TopNav", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
  });

  it("renders all nav items", () => {
    render(<TopNav />);
    expect(screen.getByText(/IT Leaderboards/i)).toBeInTheDocument();
    expect(screen.getByText(/Tome Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Drop Rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Talents/i)).toBeInTheDocument();
    expect(screen.getByText(/Sheets.*Tools/i)).toBeInTheDocument();
  });

  it("marks active item based on pathname", () => {
    mockUsePathname.mockReturnValue("/leaderboards");
    const { container } = render(<TopNav />);
    const activeLink = container.querySelector(".border-gold");
    expect(activeLink).toBeTruthy();
  });

  it("renders as a nav element", () => {
    const { container } = render(<TopNav />);
    expect(container.querySelector("nav")).toBeInTheDocument();
  });
});
