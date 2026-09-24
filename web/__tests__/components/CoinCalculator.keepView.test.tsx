import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

type LoaderProps = { onSave: (s: unknown, meta?: { refresh?: boolean }) => void; storageKey: string };
let loader: LoaderProps | null = null;
vi.mock("@/components/ProfileNameLoader", () => ({
  default: (props: LoaderProps) => {
    loader = props;
    return null;
  },
}));
vi.mock("@/lib/arkh/computeCoin", () => ({
  computeArkhCoinMulti: () => {
    throw new Error("stub");
  },
}));

import CoinCalculator from "@/components/coinMulti/CoinCalculator";

const save = () => ({
  charNames: ["Alpha", "Beta"],
  data: { PVStatList_0: [1, 1, 1, 1, 100], PVStatList_1: [1, 1, 1, 1, 90], CurrentMap_0: 2, CurrentMap_1: 14 },
});
// Char 1 is "online now": lastUpdated is fresh and char 1's PTimeAway lands
// right on it, while char 0's is 11h stale (see lib/dropRate/extract.ts).
const onlineSave = () => {
  const lastUpdated = Date.now();
  const s = save();
  return {
    ...s,
    lastUpdated,
    data: {
      ...s.data,
      PTimeAway_0: (lastUpdated - 11 * 3_600_000) / 1_000_000,
      PTimeAway_1: lastUpdated / 1_000_000,
    },
  };
};
const charSelect = () => screen.getAllByRole("combobox")[0] as HTMLSelectElement;
const mapSelect = () => screen.getAllByRole("combobox")[1] as HTMLSelectElement;

describe("CoinCalculator", () => {
  it("uses its own name key", () => {
    render(<CoinCalculator />);
    expect(loader!.storageKey).toBe("coin-multi-tracker.playerName");
  });

  it("keeps the map on refresh, re-derives it on a fresh load", () => {
    render(<CoinCalculator />);
    act(() => loader!.onSave(save()));
    expect(mapSelect().value).toBe("2");
    fireEvent.change(mapSelect(), { target: { value: "8" } }); // Poopy Sewers
    act(() => loader!.onSave(save(), { refresh: true }));
    expect(mapSelect().value).toBe("8");
    act(() => loader!.onSave(save()));
    expect(mapSelect().value).toBe("2");
  });

  it("a fresh load defaults to the character that's online now, and their map", () => {
    render(<CoinCalculator />);
    act(() => loader!.onSave(onlineSave()));
    expect(charSelect().value).toBe("1");
    expect(mapSelect().value).toBe("14");
  });

  it("a refresh keeps the user's switch away from the online character", () => {
    render(<CoinCalculator />);
    act(() => loader!.onSave(onlineSave()));
    expect(charSelect().value).toBe("1");
    fireEvent.change(charSelect(), { target: { value: "0" } });
    act(() => loader!.onSave(onlineSave(), { refresh: true }));
    expect(charSelect().value).toBe("0");
  });

  it("switching character jumps to that character's map", () => {
    render(<CoinCalculator />);
    act(() => loader!.onSave(save()));
    fireEvent.change(charSelect(), { target: { value: "1" } });
    expect(mapSelect().value).toBe("14");
  });

  it("shows the compute error with its own prefix", async () => {
    render(<CoinCalculator />);
    act(() => loader!.onSave(save()));
    expect(await screen.findByText(/Coin multi compute failed: stub/)).toBeInTheDocument();
  });
});
