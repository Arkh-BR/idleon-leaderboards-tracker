import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TopNav from "@/components/TopNav";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));
// Existing tests assert the nav renders, so keep protest mode off here.
vi.mock("@/lib/protest/config", () => ({ PROTEST_MODE: false }));

const TRACKERS = [/Drop Rate/i, /Coin Multi/i, /EXP Multi/i, /AFK Gains/i, /Multikill/i];
const trackersButton = () => screen.getByRole("button", { name: /Trackers/ });

describe("TopNav", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
  });

  it("renders the top-level items, with the stat trackers folded into Trackers", () => {
    render(<TopNav />);
    expect(screen.getByText(/IT Leaderboards/i)).toBeInTheDocument();
    expect(screen.getByText(/Tome Score/i)).toBeInTheDocument();
    expect(trackersButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/Talents/i)).toBeInTheDocument();
    expect(screen.getByText(/Cooking Mastery/i)).toBeInTheDocument();
    expect(screen.getByText(/Sheets.*Tools/i)).toBeInTheDocument();
    for (const t of TRACKERS) expect(screen.queryByRole("link", { name: t })).toBeNull();
  });

  it("opens the Trackers list on click, right after its button, with every tracker", () => {
    render(<TopNav />);
    expect(trackersButton()).not.toHaveAttribute("aria-controls");
    fireEvent.click(trackersButton());
    expect(trackersButton()).toHaveAttribute("aria-expanded", "true");
    const list = trackersButton().nextElementSibling!;
    expect(trackersButton()).toHaveAttribute("aria-controls", list.id);
    expect(list.querySelectorAll("a")).toHaveLength(5); // tab / reading order: button, then the list
    for (const t of TRACKERS) expect(screen.getByRole("link", { name: t })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Multikill/i })).toHaveAttribute("href", "/multikill");
  });

  it("closes the list on a second click, Escape, an outside press and tabbing out", () => {
    render(<TopNav />);
    fireEvent.click(trackersButton());
    fireEvent.click(trackersButton());
    expect(screen.queryByRole("link", { name: /Coin Multi/i })).toBeNull();

    trackersButton().focus(); // Escape returns focus only when it was on the button or list
    fireEvent.click(trackersButton());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: /Coin Multi/i })).toBeNull();
    expect(trackersButton()).toHaveFocus();

    fireEvent.click(trackersButton());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("link", { name: /Coin Multi/i })).toBeNull();

    fireEvent.click(trackersButton());
    fireEvent.focusOut(screen.getByRole("link", { name: /Multikill/i }), {
      relatedTarget: screen.getByRole("link", { name: /Talents/i }),
    });
    expect(screen.queryByRole("link", { name: /Coin Multi/i })).toBeNull();
  });

  it("stays open while focus moves inside the list", () => {
    render(<TopNav />);
    fireEvent.click(trackersButton());
    fireEvent.focusOut(trackersButton(), { relatedTarget: screen.getByRole("link", { name: /Drop Rate/i }) });
    expect(screen.getByRole("link", { name: /Coin Multi/i })).toBeInTheDocument();
  });

  it("marks Trackers active on a tracker page, and that tracker inside the list", () => {
    mockUsePathname.mockReturnValue("/coin-multi");
    render(<TopNav />);
    expect(trackersButton().className).toContain("border-gold");
    fireEvent.click(trackersButton());
    expect(screen.getByRole("link", { name: /Coin Multi/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /EXP Multi/i })).not.toHaveAttribute("aria-current");
  });

  it("marks active item based on pathname", () => {
    mockUsePathname.mockReturnValue("/leaderboards");
    const { container } = render(<TopNav />);
    const activeLink = container.querySelector(".border-gold");
    expect(activeLink).toBeTruthy();
    expect(trackersButton().className).not.toContain("border-gold");
  });

  it("renders as a nav element", () => {
    const { container } = render(<TopNav />);
    expect(container.querySelector("nav")).toBeInTheDocument();
  });
});
