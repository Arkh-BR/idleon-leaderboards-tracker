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
vi.mock("@/lib/arkh/computeExp", () => ({
  computeArkhExpMulti: () => {
    throw new Error("stub");
  },
}));
vi.mock("@/lib/arkh/computeCoin", () => ({
  computeArkhCoinMulti: () => {
    throw new Error("stub");
  },
}));
vi.mock("@/lib/arkh/computeAfk", () => ({
  computeArkhAfkGains: () => {
    throw new Error("stub");
  },
}));

import StatCalculator from "@/components/statTracker/StatCalculator";
import { testConfig } from "./testConfig";
import { EXP_PAGE } from "@/lib/expMulti/pageConfig";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";
import { AFK_PAGE } from "@/lib/afkGains/pageConfig";
import type { StatPageConfig } from "@/lib/statTracker/config";

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

describe("StatCalculator", () => {
  it("uses its own name key", () => {
    render(<StatCalculator config={testConfig} />);
    expect(loader!.storageKey).toBe("test-multi-tracker.playerName");
  });

  it("keeps the map on refresh, re-derives it on a fresh load", () => {
    render(<StatCalculator config={testConfig} />);
    act(() => loader!.onSave(save()));
    expect(mapSelect().value).toBe("2");
    fireEvent.change(mapSelect(), { target: { value: "8" } }); // Poopy Sewers
    act(() => loader!.onSave(save(), { refresh: true }));
    expect(mapSelect().value).toBe("8");
    act(() => loader!.onSave(save()));
    expect(mapSelect().value).toBe("2");
  });

  it("a fresh load defaults to the character that's online now, and their map", () => {
    render(<StatCalculator config={testConfig} />);
    act(() => loader!.onSave(onlineSave()));
    expect(charSelect().value).toBe("1");
    expect(mapSelect().value).toBe("14");
  });

  it("a refresh keeps the user's switch away from the online character", () => {
    render(<StatCalculator config={testConfig} />);
    act(() => loader!.onSave(onlineSave()));
    expect(charSelect().value).toBe("1");
    fireEvent.change(charSelect(), { target: { value: "0" } });
    act(() => loader!.onSave(onlineSave(), { refresh: true }));
    expect(charSelect().value).toBe("0");
  });

  it("switching character jumps to that character's map", () => {
    render(<StatCalculator config={testConfig} />);
    act(() => loader!.onSave(save()));
    fireEvent.change(charSelect(), { target: { value: "1" } });
    expect(mapSelect().value).toBe("14");
  });

  it("shows the compute error with its own prefix", async () => {
    render(<StatCalculator config={testConfig} />);
    act(() => loader!.onSave(save()));
    expect(await screen.findByText(/Test multi compute failed: stub/)).toBeInTheDocument();
  });

  it("renders the EXP Multi config", () => {
    render(<StatCalculator config={EXP_PAGE} />);
    expect(loader!.storageKey).toBe("exp-multi-tracker.playerName");
    expect(screen.getByText(/EXP Multi Calculator/)).toBeInTheDocument();
  });

  it("renders the Coin Multi config", () => {
    render(<StatCalculator config={COIN_PAGE} />);
    expect(loader!.storageKey).toBe("coin-multi-tracker.playerName");
    expect(screen.getByText(/Coin Multi Calculator/)).toBeInTheDocument();
  });

  it("renders the AFK Gains config", () => {
    render(<StatCalculator config={AFK_PAGE} />);
    expect(loader!.storageKey).toBe("afk-gains-tracker.playerName");
    expect(screen.getByText(/AFK Gains Calculator/)).toBeInTheDocument();
  });

  it("prints a % stat's headline in its unit, with the percent as the title", async () => {
    const tree = { name: "Test Multi", val: 422.31870591798446, fmt: "x" as const, children: [] };
    const pct: StatPageConfig = {
      ...testConfig,
      unit: "%",
      formatTotal: (x) => String(Math.floor(100 * x)),
      compute: async () => ({ tree, total: tree.val }),
    };
    render(<StatCalculator config={pct} />);
    act(() => loader!.onSave(save()));
    expect(await screen.findByText("42231%")).toHaveAttribute("title", "42231.87%");
  });

  it("keeps the multiplier unit by default", async () => {
    const tree = { name: "Test Multi", val: 12.5, fmt: "x" as const, children: [] };
    render(<StatCalculator config={{ ...testConfig, compute: async () => ({ tree, total: 12.5 }) }} />);
    act(() => loader!.onSave(save()));
    expect(await screen.findByText("12.50x")).toHaveAttribute("title", "1.250000e+1x");
  });
});
