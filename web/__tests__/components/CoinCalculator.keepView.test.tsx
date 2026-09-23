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
