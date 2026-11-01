import { describe, it, expect } from "vitest";
import { ARTIFACT_PAGE } from "@/lib/artifactFind/pageConfig";
import { ARTI_GROUPS, ARTI_ROOT, ARTI_VOTE_NAME } from "@/lib/arkh/stats/defs/artifact-find";

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
