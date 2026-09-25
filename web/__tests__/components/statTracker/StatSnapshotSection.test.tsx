import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useStatSnapshots } from "@/components/statTracker/StatSnapshotSection";
import type { StatCalculatorState } from "@/components/statTracker/StatCalculator";
import { testConfig } from "./testConfig";

const state = (): StatCalculatorState => ({
  charIndex: 0,
  charName: "Alpha",
  classKey: null,
  charSummary: null,
  total: 12.5,
  mapIndex: 1,
  mapLabel: "W1 · Spore Meadows",
  save: { charNames: ["Alpha"], data: { PVStatList_0: [1, 1, 1, 1, 50] } },
  tree: { name: "Test Multi", val: 12.5, fmt: "x", children: [] },
  computeError: null,
});

/** The page puts `actions` next to the total and `panel` under it. */
function StatSnapshotSection(props: Parameters<typeof useStatSnapshots>[0]) {
  const { actions, panel } = useStatSnapshots(props);
  return (
    <>
      {actions}
      {panel}
    </>
  );
}

beforeEach(() => localStorage.clear());

describe("StatSnapshotSection", () => {
  it("can't save without a computed state", () => {
    render(<StatSnapshotSection config={testConfig} state={null} />);
    // getByText(/Save snapshot/) is ambiguous here: the empty-state copy
    // ("Click "Save snapshot" above…", unchanged from Coin) also matches.
    expect(screen.getByRole("button", { name: /Save snapshot/ })).toBeDisabled();
  });

  it("saves into the stat's own key and names the stat in the notice", () => {
    localStorage.setItem(testConfig.storage.collapse, "0");
    render(<StatSnapshotSection config={testConfig} state={state()} />);
    fireEvent.click(screen.getByRole("button", { name: /Save snapshot/ }));
    expect(screen.getByText(/Snapshot saved for Alpha — Test Multi 12.50x on W1 · Spore Meadows/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(testConfig.storage.snapshots)!).snapshotsByChar.Alpha).toHaveLength(1);
  });

  it("History (N) counts the page's snapshots and opens the panel: Export, Import, chips, Clear", () => {
    const snap = (capturedAt: number, charName: string) => ({
      capturedAt,
      saveUpdatedAt: null,
      charIndex: 0,
      charName,
      level: 1,
      value: 10,
      mapName: "W1",
    });
    localStorage.setItem(
      testConfig.storage.snapshots,
      JSON.stringify({ snapshotsByChar: { Alpha: [snap(1, "Alpha"), snap(2, "Alpha")], Beta: [snap(3, "Beta")] } })
    );
    render(<StatSnapshotSection config={testConfig} state={state()} />);
    const history = screen.getByRole("button", { name: "📈 History (3)" });
    expect(history).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Export/ })).toBeNull();

    fireEvent.click(history);
    expect(history).toHaveAttribute("aria-expanded", "true");
    expect(localStorage.getItem(testConfig.storage.collapse)).toBe("0");
    expect(screen.getByRole("button", { name: "↑ Export" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Import/)).toHaveAttribute("type", "file");
    expect(screen.getByRole("button", { name: /Beta/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🗑 Clear Alpha" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save snapshot/ }));
    expect(history).toHaveTextContent("📈 History (4)");
    fireEvent.click(history);
    expect(localStorage.getItem(testConfig.storage.collapse)).toBe("1");
    expect(screen.queryByRole("button", { name: /Export/ })).toBeNull();
  });

  it("prints a % stat in the notice and the history table", async () => {
    const pct = { ...testConfig, unit: "%" as const, formatTotal: (x: number) => String(Math.floor(100 * x)) };
    localStorage.setItem(pct.storage.collapse, "0");
    render(<StatSnapshotSection config={pct} state={{ ...state(), total: 422.31870591798446 }} />);
    // getByText(/Save snapshot/) is ambiguous here too (see the test above):
    // the empty-state copy matches before any snapshot exists.
    fireEvent.click(screen.getByRole("button", { name: /Save snapshot/ }));
    expect(screen.getByText(/Snapshot saved for Alpha — Test Multi 42231% on W1 · Spore Meadows/)).toBeInTheDocument();
    expect(await screen.findByText("42231%")).toBeInTheDocument();
  });

  it("prints a plain em dash (not '—%') for a % stat with a non-finite value", () => {
    // Mirrors formatAfkGains: real page configs return "—" from formatTotal
    // for a non-finite input, so the history table must not glue a trailing
    // "%" onto that — same bare "—" the unit==='x' (Num) branch already shows.
    const pct = {
      ...testConfig,
      unit: "%" as const,
      formatTotal: (x: number) => (Number.isFinite(x) ? String(Math.floor(100 * x)) : "—"),
    };
    localStorage.setItem(pct.storage.collapse, "0");
    localStorage.setItem(
      pct.storage.snapshots,
      JSON.stringify({
        snapshotsByChar: {
          Alpha: [
            { capturedAt: 1, saveUpdatedAt: null, charIndex: 0, charName: "Alpha", level: 1, value: null, mapName: "W1" },
          ],
        },
      })
    );
    const { container } = render(<StatSnapshotSection config={pct} state={null} />);
    expect(container.querySelector("td.text-gold")?.textContent).toBe("—");
    expect(screen.queryByText("—%")).toBeNull();
  });
});
