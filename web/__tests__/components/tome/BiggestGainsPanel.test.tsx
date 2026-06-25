import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import BiggestGainsPanel from "@/components/tome/BiggestGainsPanel";

const KEY = "idleon-leaderboards.tome.rawJson";

function renderPanel() {
  return render(
    <BiggestGainsPanel dungeonAsOne={false} onToggleDungeon={() => {}} />
  );
}

// An empty save object computes cleanly: every task lands at 0 pts, so every
// task with a top-player snapshot shows a gap. That gives us a deterministic,
// snapshot-robust way to exercise the rendering contract without bundling a
// real (private) save — the exact gain math is covered in lib/tome/gains.test.ts.
const EMPTY_SAVE = "{}";

describe("BiggestGainsPanel", () => {
  it("shows the paste hint when no save has been computed", async () => {
    renderPanel();
    expect(
      await screen.findByText(/Paste your raw JSON/i)
    ).toBeInTheDocument();
  });

  it("shows an error banner when the stored JSON is invalid", async () => {
    localStorage.setItem(KEY, "{ not valid json");
    renderPanel();
    // Banner renders "⚠ Error: …", so the message no longer starts the node.
    expect(await screen.findByText(/Error:/)).toBeInTheDocument();
  });

  it("renders the hero card and the ranked table with the five columns", async () => {
    localStorage.setItem(KEY, EMPTY_SAVE);
    renderPanel();

    // Hero card.
    expect(await screen.findByText(/Biggest win →/i)).toBeInTheDocument();

    // Table headers (exact English copy). Exact-string matches avoid colliding
    // with the methodology note, which also contains "Tome pts gain".
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("You → Top")).toBeInTheDocument();
    expect(screen.getByText("Tome pts gain")).toBeInTheDocument();
    expect(screen.getByText("Next point")).toBeInTheDocument();
    expect(screen.getByText("Class")).toBeInTheDocument();
  });

  it("puts the 'biggest win' badge on the first table row only", async () => {
    localStorage.setItem(KEY, EMPTY_SAVE);
    const { container } = renderPanel();
    await screen.findByText(/Biggest win →/i);

    const badges = screen.getAllByText("biggest win");
    expect(badges).toHaveLength(1);

    const firstRow = container.querySelector("tbody tr");
    expect(firstRow).not.toBeNull();
    expect(within(firstRow as HTMLElement).getByText("biggest win")).toBeInTheDocument();
  });

  it("reveals more rows (the gated tasks) when 'Include gated tasks' is toggled on", async () => {
    localStorage.setItem(KEY, EMPTY_SAVE);
    const { container } = renderPanel();
    await screen.findByText(/Biggest win →/i);

    const before = container.querySelectorAll("tbody tr").length;
    expect(before).toBeGreaterThan(0);

    const toggle = screen.getByLabelText(/Include gated tasks/i);
    fireEvent.click(toggle);

    const after = container.querySelectorAll("tbody tr").length;
    expect(after).toBeGreaterThan(before);
  });

  it("renders the methodology note", async () => {
    localStorage.setItem(KEY, EMPTY_SAVE);
    renderPanel();
    expect(
      await screen.findByText(
        /how many points you'd gain if this task matched the top observed player/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/'Next point' shows the cheapest immediate move/i)
    ).toBeInTheDocument();
  });
});
