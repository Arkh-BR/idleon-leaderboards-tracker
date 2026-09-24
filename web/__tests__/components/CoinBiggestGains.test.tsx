import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CoinBiggestGains from "@/components/coinMulti/CoinBiggestGains";
import { COIN_GROUPS, COIN_ROOT } from "@/lib/arkh/stats/defs/coin-multi";

const G = `${COIN_ROOT} / ${COIN_GROUPS[22].name}`;
const yours = { [G]: 4, [`${G} / Alpha Source`]: 100, [`${G} / Beta Source`]: 200 };
const ref = { [`${G} / Alpha Source`]: 400, [`${G} / Beta Source`]: 200 };

describe("CoinBiggestGains", () => {
  it("asks for a save first", () => {
    render(<CoinBiggestGains yoursFlat={null} classKey={null} loadReference={async () => ref} />);
    expect(screen.getByText(/Load a save above/)).toBeInTheDocument();
  });

  it("ranks sources by the coin multi they would add", async () => {
    render(<CoinBiggestGains yoursFlat={yours} classKey={null} loadReference={async () => ref} />);
    expect(await screen.findByText(/Biggest win/)).toBeInTheDocument();
    expect(screen.getAllByText("Alpha Source").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+75.000%").length).toBeGreaterThan(0);
    expect(screen.queryByText("Beta Source")).toBeNull(); // already at the max
  });

  it("shows the compute error banner", () => {
    render(<CoinBiggestGains yoursFlat={yours} classKey={null} computeError="Coin multi compute failed: x" loadReference={async () => ref} />);
    expect(screen.getByText(/Coin multi compute failed: x/)).toBeInTheDocument();
  });
});
