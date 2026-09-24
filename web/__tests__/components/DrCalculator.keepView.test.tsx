import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

type LoaderProps = { onSave: (s: unknown, meta?: { refresh?: boolean }) => void };
let loader: LoaderProps | null = null;
vi.mock("@/components/ProfileNameLoader", () => ({
  default: (props: LoaderProps) => {
    loader = props;
    return null;
  },
}));
// The DR engine isn't under test: fail fast instead of computing.
vi.mock("@/lib/arkh/computeDR", () => ({
  computeArkhDropRate: () => {
    throw new Error("stub");
  },
}));

import DrCalculator from "@/components/dropRate/DrCalculator";

// Two chars on different maps; buildMapOptions always lists each CurrentMap_N.
const save = () => ({
  charNames: ["Alpha", "Beta"],
  data: {
    PVStatList_0: [1, 1, 1, 1, 100],
    PVStatList_1: [1, 1, 1, 1, 90],
    CurrentMap_0: 2,
    CurrentMap_1: 3,
  },
});
const mapSelect = () => screen.getAllByRole("combobox")[1] as HTMLSelectElement;
const charSelect = () => screen.getAllByRole("combobox")[0] as HTMLSelectElement;

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

describe("DrCalculator — defaults to the online character", () => {
  it("a fresh load defaults to the character that's online now, and their map", () => {
    render(<DrCalculator />);
    act(() => loader!.onSave(onlineSave()));
    expect(charSelect().value).toBe("1");
    expect(mapSelect().value).toBe("3"); // char 1's current map
  });

  it("a refresh keeps the user's switch away from the online character", () => {
    render(<DrCalculator />);
    act(() => loader!.onSave(onlineSave()));
    expect(charSelect().value).toBe("1");
    fireEvent.change(charSelect(), { target: { value: "0" } });
    act(() => loader!.onSave(onlineSave(), { refresh: true }));
    expect(charSelect().value).toBe("0");
  });
});

describe("DrCalculator — account refresh keeps the view", () => {
  it("keeps map + chip on refresh, re-derives them on a fresh load", () => {
    render(<DrCalculator />);
    act(() => loader!.onSave(save()));
    expect(mapSelect().value).toBe("2"); // char 0's current map

    fireEvent.change(mapSelect(), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Chip Gallery AUTO/ }));
    expect(mapSelect().value).toBe("3");
    expect(screen.getByRole("button", { name: /Chip Gallery ON/ })).toBeInTheDocument();

    act(() => loader!.onSave(save(), { refresh: true }));
    expect(mapSelect().value).toBe("3");
    expect(screen.getByRole("button", { name: /Chip Gallery ON/ })).toBeInTheDocument();

    act(() => loader!.onSave(save()));
    expect(mapSelect().value).toBe("2");
    expect(screen.getByRole("button", { name: /Chip Gallery AUTO/ })).toBeInTheDocument();
  });

  it("falls back to selected character's map on refresh when their previous map disappears", () => {
    const save3chars = () => ({
      charNames: ["Alpha", "Beta", "Gamma"],
      data: {
        PVStatList_0: [1, 1, 1, 1, 100],
        PVStatList_1: [1, 1, 1, 1, 90],
        PVStatList_2: [1, 1, 1, 1, 80],
        CurrentMap_0: 2,
        CurrentMap_1: 3,
        CurrentMap_2: 4,
      },
    });
    const charSelect = () => screen.getAllByRole("combobox")[0] as HTMLSelectElement;

    render(<DrCalculator />);
    act(() => loader!.onSave(save3chars()));
    expect(charSelect().value).toBe("0");
    expect(mapSelect().value).toBe("2");

    // Select Beta (char 1)
    fireEvent.change(charSelect(), { target: { value: "1" } });
    expect(mapSelect().value).toBe("3"); // Beta's current map

    // Select map 4 (Gamma's current map)
    fireEvent.change(mapSelect(), { target: { value: "4" } });
    expect(mapSelect().value).toBe("4");

    // Refresh with CurrentMap_2 = 2, so map 4 disappears from options
    const save3charsUpdated = () => ({
      charNames: ["Alpha", "Beta", "Gamma"],
      data: {
        PVStatList_0: [1, 1, 1, 1, 100],
        PVStatList_1: [1, 1, 1, 1, 90],
        PVStatList_2: [1, 1, 1, 1, 80],
        CurrentMap_0: 2,
        CurrentMap_1: 3,
        CurrentMap_2: 2, // was 4, now gone from options
      },
    });

    act(() => loader!.onSave(save3charsUpdated(), { refresh: true }));
    // Without the fix, mapIdx would reset to Alpha's current map (2) because
    // applyParsedSave always uses list[0].charIndex.
    // With the fix, it falls back to Beta's current map (3).
    expect(mapSelect().value).toBe("3"); // Beta's current map, not Alpha's
    expect(charSelect().value).toBe("1"); // Character stays on Beta
  });
});
