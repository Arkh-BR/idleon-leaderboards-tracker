import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BoardExpand from "@/components/leaderboards/BoardExpand";
import type { BoardRow, LbBoard } from "@/lib/leaderboards/types";

const rows = (n: number, from = 1): BoardRow[] => Array.from({ length: n }, (_, i) => ({ mainChar: `P${from + i}`, value: 1000 - i, rank: from + i }));
const board = (over: Partial<LbBoard> = {}): LbBoard => ({ metric: "m", createdAt: 0, top: rows(100), around: [], ...over });
const stub = (res: unknown, ok = true) => {
  const f = vi.fn(async () => ({ ok, json: async () => res }));
  vi.stubGlobal("fetch", f);
  return f;
};
const view = (player: string | null = "p52", hideAnon = false) =>
  render(<table><tbody><BoardExpand metric="m" notation="default" player={player} hideAnon={hideAnon} /></tbody></table>);

afterEach(() => vi.unstubAllGlobals());

describe("BoardExpand", () => {
  it("shows the around rows with the player highlighted (case-insensitive)", async () => {
    stub(board({ around: rows(11, 47) }));
    view("p52");
    const row = (await screen.findByText("P52")).closest("tr")!;
    expect(row.className).toContain("emerald");
    expect(screen.getByText("P47")).toBeTruthy();
    expect(screen.queryByText("P1")).toBeNull();
  });

  it("Full top 100 reveals all 100 rows", async () => {
    stub(board({ around: rows(11, 47) }));
    view();
    fireEvent.click(await screen.findByRole("button", { name: "Full top 100" }));
    expect(screen.getAllByText(/^P[0-9]+$/)).toHaveLength(100);
  });

  it("no player: first 10 of top plus the button", async () => {
    stub(board());
    view(null);
    await screen.findByText("P10");
    expect(screen.queryByText("P11")).toBeNull();
    expect(screen.getByRole("button", { name: "Full top 100" })).toBeTruthy();
  });

  it("player not on the board: top 10 and a notice", async () => {
    stub(board());
    view("ghost");
    expect(await screen.findByText("You're not on this board yet")).toBeTruthy();
    expect(screen.getByText("P10")).toBeTruthy();
  });

  it("adds public=1 when hideAnon", async () => {
    const f = stub(board());
    view("p52", true);
    await screen.findByText("P10");
    expect((f.mock.calls[0] as unknown[])[0]).toBe("/api/lb/board?metric=m&around=p52&public=1");
  });

  it("error shows retry, which refetches", async () => {
    const f = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ error: "x" }) }).mockResolvedValue({ ok: true, json: async () => board() });
    vi.stubGlobal("fetch", f);
    view(null);
    expect(await screen.findByText("Couldn't reach Idleon Toolbox.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("P10")).toBeTruthy());
    expect(f).toHaveBeenCalledTimes(2);
  });
});
