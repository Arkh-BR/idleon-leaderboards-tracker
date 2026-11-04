import { describe, it, expect } from "vitest";
import { ARTIFACT_PAGE, pageError, withPageErrors } from "@/lib/artifactFind/pageConfig";
import { ARTI_GROUPS, ARTI_ROOT, ARTI_VOTE_NAME } from "@/lib/arkh/stats/defs/artifact-find";
import { IncompleteTome, MissingSaveKey, NotPorted, TreeTotalMismatch } from "@/lib/game/errors";
import { UNPORTED_STEPS } from "@/lib/game/migrations";
import type { StatResult } from "@/lib/statTracker/config";

describe("Artifact Find page config", () => {
  it("uses its own storage keys", () => {
    expect(ARTIFACT_PAGE.storage).toMatchObject({
      save: "artifact-find-tracker.last-upload.v1",
      name: "artifact-find-tracker.playerName",
      snapshots: "artifact-find-tracker.v1",
      collapse: "artifact-find.snapshot-section.collapsed.v1",
      exportPrefix: "artifact-find-snapshots",
      exportLabel: "artifact-find-tracker",
    });
    expect(ARTIFACT_PAGE.storage.legacyValueKey).toBeUndefined();
  });

  it("has no map selector", () => {
    expect(ARTIFACT_PAGE.noMap).toBe(true);
  });

  it("loads the Observed Max for a class", async () => {
    const top = await ARTIFACT_PAGE.loadTop();
    expect(Object.keys(top.flatForClass(null)).length).toBeGreaterThan(0);
  });

  it("doesn't rank the weekly vote (Vote 20)", () => {
    const G = `${ARTI_ROOT} / ${ARTI_GROUPS.find((g) => g.sources.includes("vote20"))!.name}`;
    const rows = ARTIFACT_PAGE.gains.sources({ [`${G} / ${ARTI_VOTE_NAME}`]: 0 }, { [`${G} / ${ARTI_VOTE_NAME}`]: 30 });
    expect(rows.some((r) => r.source === ARTI_VOTE_NAME)).toBe(false);
  });
});

// The kit prints "<errPrefix>: <message>" when compute throws, so the engine's refusals are turned into sentences here.
describe("what the page shows when the engine refuses a save", () => {
  const OLD = { data: { CSver: 23.05 } };
  const CURRENT = { data: { CSver: 34.05 } };

  it("tells an old save (below CSver 34.05) to be reloaded, naming the missing key", () => {
    const e = pageError(OLD, new MissingSaveKey("Spelunk[49]"));
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).toBe("This save is from an older game version (missing Spelunk[49]). Sign in or paste a fresh save.");
    // a save older than the game's load steps lib/game replays: said in words, no internal name
    expect((pageError(OLD, new MissingSaveKey(UNPORTED_STEPS)) as Error).message).toBe(
      "This save is from an older game version that this tracker can't update yet. Sign in or paste a fresh save."
    );
  });

  it("does the same for a partial Tome (IncompleteTome is a MissingSaveKey)", () => {
    const e = pageError({ data: { CSver: 34 } }, new IncompleteTome([{ idx: 107, task: "x", source: "y" }]));
    expect((e as Error).message).toBe("This save is from an older game version (missing Tome rows 107). Sign in or paste a fresh save.");
  });

  it("does not call a current save old: a missing key there passes through as the engine said it", () => {
    const miss = new MissingSaveKey("Menagerie"); // a 34.05 save has it: its absence is a gap, not age
    expect(pageError(CURRENT, miss)).toBe(miss);
    expect(pageError({ data: {} }, miss)).toBe(miss); // no CSver: nothing says it is old
    expect(pageError(null, miss)).toBe(miss);
  });

  it("says the tree is incomplete when it no longer adds up to the total", () => {
    expect((pageError(CURRENT, new TreeTotalMismatch(2, 3)) as Error).message).toBe(
      "Artifact Find is incomplete for this save (internal check failed). Please report it."
    );
  });

  it("lets every other error through untouched", () => {
    for (const e of [new NotPorted("Sailing", "x"), new TypeError("y"), "z"]) expect(pageError(OLD, e)).toBe(e);
  });

  it("withPageErrors returns the result as is and maps what compute throws", async () => {
    const ok: StatResult = { total: 1, tree: { name: "t", val: 1, fmt: "x" } };
    expect(await withPageErrors(async () => ok)(CURRENT, 0, 0)).toBe(ok);
    await expect(
      withPageErrors(async () => {
        throw new MissingSaveKey("Spelunk[49]");
      })(OLD, 0, 0)
    ).rejects.toThrow(/older game version \(missing Spelunk\[49\]\)/);
    const other = new NotPorted("Sailing", "x");
    await expect(
      withPageErrors(() => {
        throw other; // a synchronous throw too
      })(OLD, 0, 0)
    ).rejects.toBe(other);
  });
});
