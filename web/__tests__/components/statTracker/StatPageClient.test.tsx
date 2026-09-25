import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

type LoaderProps = { onSave: (s: unknown, meta?: { refresh?: boolean }) => void; compact?: boolean };
let loader: LoaderProps | null = null;
vi.mock("@/components/ProfileNameLoader", () => ({
  default: (props: LoaderProps) => {
    loader = props;
    return null;
  },
}));

import StatPageClient from "@/components/statTracker/StatPageClient";
import type { StatPageConfig } from "@/lib/statTracker/config";
import { testConfig } from "./testConfig";

const tree = { name: "Test Multi", val: 12.5, fmt: "x" as const, children: [] };
const config = (over: Partial<StatPageConfig> = {}): StatPageConfig => ({
  ...testConfig,
  compute: async () => ({ tree, total: 12.5 }),
  ...over,
});
const save = () => ({ charNames: ["Alpha"], data: { PVStatList_0: [1, 1, 1, 1, 100], CurrentMap_0: 2 } });

/** Renders the page, loads a save and returns the headline total. */
async function loaded(cfg = config()) {
  render(<StatPageClient config={cfg} />);
  act(() => loader!.onSave(save()));
  return screen.findByText("12.50x");
}

describe("StatPageClient — the tracker header", () => {
  it("the save card is compact; no anonymous note at the top of the page", async () => {
    await loaded();
    expect(loader!.compact).toBe(true);
    expect(screen.queryByText(/Anonymous players/)).toBeNull();
  });

  it("Compare vs Observed Max is a checkbox at the top of the Tree tab only", async () => {
    await loaded();
    // 💡 Biggest Gains is the default tab.
    expect(screen.queryByLabelText(/Compare vs Observed Max/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "🌳 Tree" }));
    const compare = screen.getByLabelText(/Compare vs Observed Max/);
    expect(compare).toHaveAttribute("type", "checkbox");
    expect(compare).not.toBeChecked();

    fireEvent.click(compare);
    expect(await screen.findByText("Observed Max (3 top players)")).toBeInTheDocument();
    expect(compare).toBeChecked();
    fireEvent.click(compare);
    expect(screen.queryByText("Observed Max (3 top players)")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "💡 Biggest Gains" }));
    expect(screen.queryByLabelText(/Compare vs Observed Max/)).toBeNull();
  });
});
