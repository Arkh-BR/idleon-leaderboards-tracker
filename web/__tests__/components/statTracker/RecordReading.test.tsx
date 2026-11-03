import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importBundle } from "@/scripts/readings/import";
import RecordReading from "@/components/statTracker/RecordReading";
import { INTERMEDIATES } from "@/lib/readings/catalog";
import { DAMAGE_PAGE } from "@/lib/damage/pageConfig";
import { COIN_PAGE } from "@/lib/coinMulti/pageConfig";
import { EXP_PAGE } from "@/lib/expMulti/pageConfig";
import { AFK_PAGE } from "@/lib/afkGains/pageConfig";
import { MULTIKILL_PAGE } from "@/lib/multikill/pageConfig";
import { ARTIFACT_PAGE } from "@/lib/artifactFind/pageConfig";
import { DR2_PAGE } from "@/lib/dropRateV2/pageConfig";

// `refreshToken` is not part of the envelope: the download must drop it.
const save = {
  data: { PVStatList_3: [1, 1, 1, 1, 100] },
  charNames: ["a", "b", "c", "Farkhe"],
  lastUpdated: Date.UTC(2026, 10, 3, 12, 0, 0),
  refreshToken: "secret",
};
const props = { stat: "damage" as const, label: "Damage", save, charIdx: 3, charName: "Farkhe", mapIdx: 150 };

// happy-dom's history.pushState leaves location alone; the setter updates it.
const setSearch = (s: string) => {
  window.location.search = s;
};

describe("RecordReading", () => {
  let blobs: Blob[];
  let names: string[];

  beforeEach(() => {
    blobs = [];
    names = [];
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => (blobs.push(b as Blob), "blob:x"));
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setSearch("");
  });

  it("renders nothing without ?debug=1", () => {
    render(<RecordReading {...props} />);
    expect(screen.queryByRole("button", { name: "Record in-game reading" })).toBeNull();
  });

  it("with ?debug=1 the form downloads a bundle the importer takes", async () => {
    setSearch("?debug=1");
    render(<RecordReading {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Record in-game reading" }));
    expect(screen.getByText("Type exactly what the game shows")).toBeInTheDocument();
    const download = screen.getByRole("button", { name: "Download" });
    expect(download).toBeDisabled(); // nothing typed yet

    fireEvent.change(screen.getByLabelText("Damage"), { target: { value: "💎1₸~2₸" } });
    fireEvent.change(screen.getByLabelText("maxHp"), { target: { value: "396T" } });
    fireEvent.click(download);

    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^reading-damage-Farkhe-\d{12}\.json$/);
    const text = await blobs[0].text();
    const bundle = JSON.parse(text);
    expect(bundle.reading).toMatchObject({
      stat: "damage", charIdx: 3, charName: "Farkhe", map: 150, game: "💎1₸~2₸",
      capturedAt: "2026-11-03T12:00:00.000Z", extra: { maxHp: "396T" },
    });
    expect(bundle.reading.id).toMatch(/^\d{12}-damage-farkhe$/);
    expect(bundle.envelope.data).toEqual(save.data);
    expect(bundle.envelope.lastUpdated).toBe(save.lastUpdated);
    expect(text).not.toMatch(/token|session/i);

    const tmp = mkdtempSync(join(tmpdir(), "readings-"));
    try {
      expect(importBundle(bundle, join(tmp, "s"), join(tmp, "i.json")).id).toBe(bundle.reading.id);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("asks for the intermediates only for damage", () => {
    setSearch("?debug=1");
    const { unmount } = render(<RecordReading {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Record in-game reading" }));
    for (const k of INTERMEDIATES.damage) expect(screen.getByLabelText(k)).toBeInTheDocument();
    unmount();

    render(<RecordReading {...props} stat="coinMulti" label="Coin Multi" />);
    fireEvent.click(screen.getByRole("button", { name: "Record in-game reading" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("every kit page says which stat it records", () => {
    const stats = [DAMAGE_PAGE, COIN_PAGE, EXP_PAGE, AFK_PAGE, MULTIKILL_PAGE, ARTIFACT_PAGE, DR2_PAGE].map((p) => p.readingStat);
    expect(stats).toEqual(["damage", "coinMulti", "expMulti", "afkGains", "multikill", "artifactFind", "dropRateV2"]);
  });
});
