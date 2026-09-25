import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PasteSaveDetails from "@/components/PasteSaveDetails";

describe("PasteSaveDetails", () => {
  it("summary reads 'Paste a save'; the Copy for Support hint is in the expanded content", () => {
    const { container } = render(<PasteSaveDetails onLoad={() => true} />);
    const summary = container.querySelector("summary")!;
    expect(summary).toHaveTextContent("📋 Paste a save");
    expect(summary).not.toHaveTextContent(/Copy for Support/);
    const hint = screen.getByRole("link", { name: "idleontoolbox.com" }).closest("p")!;
    expect(hint).toHaveTextContent(/Uses the “Copy for Support” button on idleontoolbox\.com/);
    expect(summary.contains(hint)).toBe(false);
  });

  it("bare: just the hint, the box and the button — no <details>/<summary>", () => {
    const { container } = render(<PasteSaveDetails onLoad={() => true} bare />);
    expect(container.querySelector("details, summary")).toBeNull();
    expect(screen.queryByText("📋 Paste a save")).toBeNull();
    expect(screen.getByRole("link", { name: "idleontoolbox.com" })).toBeVisible();
    expect(screen.getByPlaceholderText(/Copy for Support/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Load pasted save" })).toBeVisible();
  });

  it("hands the text to onLoad and clears the box only when it loaded", () => {
    const onLoad = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<PasteSaveDetails onLoad={onLoad} />);
    const box = screen.getByPlaceholderText(/Copy for Support/) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Load pasted save" }));
    expect(onLoad).toHaveBeenLastCalledWith("{}");
    expect(box.value).toBe("{}");
    fireEvent.click(screen.getByRole("button", { name: "Load pasted save" }));
    expect(box.value).toBe("");
  });
});
