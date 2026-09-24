import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatBiggestGains from "@/components/statTracker/StatBiggestGains";
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
});
