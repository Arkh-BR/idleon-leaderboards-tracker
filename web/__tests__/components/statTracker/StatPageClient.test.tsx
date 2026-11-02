import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, within, waitFor } from "@testing-library/react";

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

  it("History (N) and Save snapshot sit in a row under the total; History opens the panel under it", async () => {
    const total = await loaded();
    const box = total.parentElement!;
    expect(within(box).queryByRole("button")).toBeNull(); // the total stands alone
    const row = box.nextElementSibling as HTMLElement;
    const history = within(row).getByRole("button", { name: "📈 History (0)" });
    const saveButton = within(row).getByRole("button", { name: "💾 Save snapshot" });
    expect(row.firstElementChild).toBe(history); // History left, Save snapshot right
    expect(screen.queryByText(/Snapshot History/)).toBeNull();

    // Enabled once the calculator has lifted its state to the page.
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);
    expect(history).toHaveTextContent("📈 History (1)");
    expect(screen.queryByRole("button", { name: /Export/ })).toBeNull();
    fireEvent.click(history);
    const card = box.parentElement!; // the character & map card
    expect(within(card).getByText(/Snapshot saved for Alpha/)).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "↑ Export" })).toBeInTheDocument();
    expect(within(card).getByLabelText(/Import/)).toHaveAttribute("type", "file");
    expect(within(card).getByRole("button", { name: "🗑 Clear Alpha" })).toBeInTheDocument();
  });

  it("Compare vs Observed Max is a checkbox at the tab strip's right end, on the Tree tab only", async () => {
    await loaded();
    // 💡 Biggest Gains is the default tab.
    expect(screen.queryByLabelText(/Compare vs Observed Max/)).toBeNull();
    const treeTab = screen.getByRole("button", { name: "🌳 Tree" });
    fireEvent.click(treeTab);
    const compare = screen.getByLabelText(/Compare vs Observed Max/);
    expect(compare).toHaveAttribute("type", "checkbox");
    expect(treeTab.parentElement!.nextElementSibling).toContainElement(compare); // right after the tabs
    expect(compare).not.toBeChecked();

    fireEvent.click(compare);
    expect(await screen.findByText("Observed Max (3 top players)")).toBeInTheDocument();
    expect(compare).toBeChecked();
    fireEvent.click(compare);
    expect(screen.queryByText("Observed Max (3 top players)")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "💡 Biggest Gains" }));
    expect(screen.queryByLabelText(/Compare vs Observed Max/)).toBeNull();
  });

  describe("reference toggle", () => {
    // Observed Max: Pool = +100% (50 + 50) doubles the root; without it the root is 1.
    const REF = { "Test Multi": 2, "Test Multi / Pool": 2, "Test Multi / Pool / a": 50, "Test Multi / Pool / b": 50 };
    const refToggle = { label: "🗺️ Include Pool", title: "Include the Pool in the Observed Max", groupPath: "Test Multi / Pool" };
    const withToggle = () => {
      const totalFromFlat = vi.fn(testConfig.gains.totalFromFlat);
      const cfg = config({
        refToggle,
        gains: { ...testConfig.gains, totalFromFlat },
        loadTop: async () => ({ flatForClass: () => REF }),
      });
      return { cfg, totalFromFlat };
    };
    /** The root row's 🎯 reference badge (the baseline's root value). */
    const rootRef = () => screen.getAllByTitle(/Reference \(Observed Max\)/)[0].textContent;

    it("appears only while Compare is on, checked by default", async () => {
      await loaded(withToggle().cfg);
      fireEvent.click(screen.getByRole("button", { name: "🌳 Tree" }));
      expect(screen.queryByLabelText(/Include Pool/)).toBeNull();
      const compare = screen.getByLabelText(/Compare vs Observed Max/);
      fireEvent.click(compare);
      const box = await screen.findByLabelText(/Include Pool/);
      expect(box).toHaveAttribute("type", "checkbox");
      expect(box).toBeChecked();
      expect(box.closest("label")).toHaveAttribute("title", refToggle.title);
      fireEvent.click(compare);
      expect(screen.queryByLabelText(/Include Pool/)).toBeNull();
    });

    it("unchecked: the baseline loses the group's subtree and the root is replayed through totalFromFlat", async () => {
      const { cfg, totalFromFlat } = withToggle();
      await loaded(cfg);
      fireEvent.click(screen.getByRole("button", { name: "🌳 Tree" }));
      fireEvent.click(screen.getByLabelText(/Compare vs Observed Max/));
      const box = await screen.findByLabelText(/Include Pool/);
      expect(rootRef()).toContain("2");

      fireEvent.click(box);
      expect(box).not.toBeChecked();
      const stripped = totalFromFlat.mock.calls.at(-1)![0];
      expect(Object.keys(stripped).filter((p) => p.startsWith("Test Multi / Pool"))).toEqual([]);
      expect(totalFromFlat).toHaveReturnedWith(1); // the missing group is neutral
      expect(rootRef()).toContain("1");
      expect(rootRef()).not.toContain("2");

      fireEvent.click(box);
      expect(rootRef()).toContain("2");
    });

    it("without refToggle there is no checkbox", async () => {
      await loaded();
      fireEvent.click(screen.getByRole("button", { name: "🌳 Tree" }));
      fireEvent.click(screen.getByLabelText(/Compare vs Observed Max/));
      await screen.findByText("Observed Max (3 top players)");
      expect(screen.queryByLabelText(/Include/)).toBeNull();
    });
  });

  it("the comparison banner's hint points at whatever drives it", async () => {
    await loaded();
    const saveButton = screen.getByRole("button", { name: "💾 Save snapshot" });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);
    fireEvent.click(screen.getByRole("button", { name: /History \(1\)/ }));
    fireEvent.click(screen.getByRole("button", { name: "🌳 Tree" }));

    fireEvent.click(screen.getByRole("button", { name: "▶ Compare" })); // a snapshot baseline
    expect(screen.getByText("Pick another snapshot in History to switch, or toggle it off there")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Compare vs Observed Max/));
    expect(await screen.findByText("Uncheck Compare vs Observed Max to hide it")).toBeInTheDocument();
    expect(screen.queryByText(/Pick another snapshot/)).toBeNull();
  });
});
