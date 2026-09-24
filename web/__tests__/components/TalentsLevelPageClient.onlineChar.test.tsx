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
// The talent engine isn't under test: fail fast instead of computing.
vi.mock("@/lib/talentsLevel/compute", () => ({
  getActivePresetIdx: () => 0,
  computeTalentEffective: () => {
    throw new Error("stub");
  },
}));
vi.mock("@/lib/talentsLevel/toMax", () => ({ computeTalentsToMax: () => [] }));
vi.mock("@/lib/talentsLevel/unbooked", () => ({ computeUnbooked: () => [] }));

import TalentsLevelPageClient from "@/app/talents-level/TalentsLevelPageClient";

const save = () => ({
  charNames: ["Alpha", "Beta"],
  data: { PVStatList_0: [1, 1, 1, 1, 100], PVStatList_1: [1, 1, 1, 1, 90] },
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
const charSelect = () => screen.getByRole("combobox") as HTMLSelectElement;

describe("TalentsLevelPageClient — defaults to the online character", () => {
  it("a fresh load defaults to the character that's online now", () => {
    render(<TalentsLevelPageClient />);
    act(() => loader!.onSave(onlineSave()));
    expect(charSelect().value).toBe("1");
  });

  it("a same-account resync (refresh) keeps the user's switch away from the online character", () => {
    render(<TalentsLevelPageClient />);
    act(() => loader!.onSave(onlineSave()));
    expect(charSelect().value).toBe("1");
    fireEvent.change(charSelect(), { target: { value: "0" } });
    act(() => loader!.onSave(onlineSave(), { refresh: true }));
    expect(charSelect().value).toBe("0");
  });
});
