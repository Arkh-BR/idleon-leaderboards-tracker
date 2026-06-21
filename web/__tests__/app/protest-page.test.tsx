// web/__tests__/app/protest-page.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProtestPage, { metadata } from "@/app/protest/page";
import { PROTEST } from "@/lib/protest/config";

describe("ProtestPage", () => {
  it("shows the headline and the bug explanation", () => {
    render(<ProtestPage />);
    expect(
      screen.getByRole("heading", { name: PROTEST.headline })
    ).toBeInTheDocument();
    expect(screen.getByText(/What.s broken/i)).toBeInTheDocument();
  });

  it("links to the official Discord in a new tab", () => {
    render(<ProtestPage />);
    const link = screen.getByRole("link", { name: /Report on Discord/i });
    expect(link).toHaveAttribute("href", PROTEST.discordInvite);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("is excluded from search indexing", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
