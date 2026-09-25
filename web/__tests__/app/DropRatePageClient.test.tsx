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
// The engine and the (large) Observed Max table aren't under test.
vi.mock("@/lib/arkh/computeDR", () => ({
  computeArkhDropRate: () => ({ tree: { name: "Drop Rate", val: 2.5, fmt: "x", children: [] }, total: 2.5 }),
}));
vi.mock("@/lib/dropRate/topDropRate", () => ({ topDrFlatForClass: () => ({ "Drop Rate": 5 }) }));

import DropRatePageClient from "@/app/drop-rate/DropRatePageClient";

const save = () => ({ charNames: ["Alpha"], data: { PVStatList_0: [1, 1, 1, 1, 100], CurrentMap_0: 0 } });

/** Renders the page, loads a save and returns the headline total. */
async function loaded() {
  render(<DropRatePageClient />);
  act(() => loader!.onSave(save()));
  return screen.findByText("2.50x");
}

describe("DropRatePageClient — the tracker header", () => {
  it("the save card is compact; no anonymous note at the top of the page", async () => {
    await loaded();
    expect(loader!.compact).toBe(true);
    expect(screen.queryByText(/Anonymous players/)).toBeNull();
  });

  it("History (N) and Save snapshot sit in a row under the total; History opens the panel under it", async () => {
    const total = await loaded();
    const box = total.parentElement!.parentElement!; // total → its label group → the total box
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

  it("Compare vs Observed Max sits at the tab strip's right end on Tree and Per World; Include Arcane Map in the banner while comparing", async () => {
    await loaded();
    // 💡 Biggest Gains is the default tab.
    expect(screen.queryByLabelText(/Compare vs Observed Max/)).toBeNull();
    const treeTab = screen.getByRole("button", { name: "🌳 Tree" });
    fireEvent.click(treeTab);
    const compare = screen.getByLabelText(/Compare vs Observed Max/);
    expect(compare).toHaveAttribute("type", "checkbox");
    expect(treeTab.parentElement!.nextElementSibling).toContainElement(compare); // right after the tabs
    expect(screen.queryByLabelText(/Include Arcane Map/)).toBeNull(); // only while comparing

    fireEvent.click(compare);
    const who = await screen.findByText(/^Observed Max \(\d+ top players\)$/);
    expect(compare).toBeChecked();
    const arcane = screen.getByLabelText(/Include Arcane Map/);
    expect(who.closest("div")).toContainElement(arcane); // the comparison banner
    fireEvent.click(arcane);
    expect(screen.getByText(/^Observed Max \(\d+ top players\) · no Arcane Map$/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "🌍 Per World" }));
    expect(screen.getByLabelText(/Compare vs Observed Max/)).toBeChecked();
    expect(screen.getByLabelText(/Include Arcane Map/)).not.toBeChecked();
    fireEvent.click(screen.getByLabelText(/Compare vs Observed Max/));
    expect(screen.queryByLabelText(/Include Arcane Map/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "💡 Biggest Gains" }));
    expect(screen.queryByLabelText(/Compare vs Observed Max/)).toBeNull();
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
