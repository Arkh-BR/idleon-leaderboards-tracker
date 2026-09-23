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
});
