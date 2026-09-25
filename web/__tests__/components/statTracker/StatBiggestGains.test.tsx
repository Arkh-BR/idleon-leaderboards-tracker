import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StatBiggestGains from "@/components/statTracker/StatBiggestGains";
import type { GainsModel } from "@/lib/statTracker/config";
import { testConfig } from "./testConfig";

const G = "Test Multi / Pool";
const yours = { [`${G} / Alpha Source`]: 100, [`${G} / Beta Source`]: 200 };
const ref = { [`${G} / Alpha Source`]: 400, [`${G} / Beta Source`]: 200 };

describe("StatBiggestGains", () => {
  it("asks for a save first", () => {
    render(<StatBiggestGains config={testConfig} yoursFlat={null} classKey={null} loadReference={async () => ref} />);
    expect(screen.getByText(/Load a save above/)).toBeInTheDocument();
  });

  it("ranks sources by the total they would add", async () => {
    render(<StatBiggestGains config={testConfig} yoursFlat={yours} classKey={null} loadReference={async () => ref} />);
    expect(await screen.findByText(/Biggest win/)).toBeInTheDocument();
    expect(screen.getAllByText("Alpha Source").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+75.000%").length).toBeGreaterThan(0);
    expect(screen.queryByText("Beta Source")).toBeNull(); // already at the max
  });

  it("keeps the methodology note when every source is already at the max", async () => {
    render(<StatBiggestGains config={testConfig} yoursFlat={ref} classKey={null} loadReference={async () => ref} />);
    expect(await screen.findByText(/at or above the Observed Max on every source/)).toBeInTheDocument();
    expect(screen.getByText(testConfig.methodologyNote)).toBeInTheDocument();
  });

  it("says the stat is 0 on this map instead of blaming the reference", async () => {
    // A flat tree whose total is genuinely 0 (e.g. AFK on a town, or any
    // Nothing-type map) — totalFromFlat(yoursFlat) itself must gate this,
    // not comparableSources (which is also 0 here, but for the wrong reason).
    const zeroGains: GainsModel = {
      sources: () => [{ path: `${G} / Alpha Source`, group: "Pool", source: "Alpha Source", display: "pct" }],
      totalFromFlat: (flat) => Number(flat[`${G} / Alpha Source`]) || 0,
    };
    const cfg = { ...testConfig, gains: zeroGains };
    const zeroFlat = { [`${G} / Alpha Source`]: 0 };
    render(<StatBiggestGains config={cfg} yoursFlat={zeroFlat} classKey={null} loadReference={async () => ref} />);
    expect(await screen.findByText(`${testConfig.statName} is 0 on this map — pick a map where it applies.`)).toBeInTheDocument();
    expect(screen.queryByText(/No comparable top-player reference/)).toBeNull();
  });

  it("shows the compute error banner", () => {
    render(
      <StatBiggestGains
        config={testConfig}
        yoursFlat={yours}
        classKey={null}
        computeError="Test multi compute failed: x"
        loadReference={async () => ref}
      />
    );
    expect(screen.getByText(/Test multi compute failed: x/)).toBeInTheDocument();
  });

  it("doesn't refetch the reference on an unrelated re-render when loadReference is omitted", async () => {
    // Regression: the default loader used to be a fresh arrow function on
    // every render (no loadReference prop passed), so any unrelated parent
    // re-render re-fired the fetch effect and flashed the loading state.
    const loadTop = vi.fn(async () => ({ flatForClass: () => ref }));
    const cfg = { ...testConfig, loadTop };
    const { rerender } = render(<StatBiggestGains config={cfg} yoursFlat={yours} classKey={null} />);
    await screen.findByText(/Biggest win/);
    rerender(<StatBiggestGains config={cfg} yoursFlat={yours} classKey={null} />);
    expect(loadTop).toHaveBeenCalledTimes(1);
  });
});
