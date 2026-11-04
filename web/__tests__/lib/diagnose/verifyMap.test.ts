import { describe, it, expect } from "vitest";
import { notPorted, traceNodes, verifyMap, verifyReport, verifySummary, type VerifyRow } from "@/lib/diagnose/verifyMap";
import type { TraceNode } from "@/lib/game/trace";
import type { Reading, StatKey } from "@/lib/readings/types";

const node = (block: string, args: unknown[] = [], children: TraceNode[] = [], note?: string): TraceNode => ({
  block,
  args,
  value: 0,
  children,
  ...(note ? { note } : {}),
});
const root = (...children: TraceNode[]) => node("(root)", [], children);
const runtime = (block: string) => node(block, [], [], "runtime: buff");
// a stand-in for runtime-only state, stated openly (ctx.ts assumed): it is no N.js block either
const assumed = (block: string) => node(block, [], [], "assumed: the lab is connected");
const cached = (block: string, args: unknown[] = []) => node(block, args, [], "cached");
// an asNum on an index the save lacks: not an N.js call, so it is no block of the map
const absent = (address: string) => node("(absent)", [address], [], "absent: asNumber(null) = 0");

const reading = (id: string, stat: StatKey, extra: Partial<Record<StatKey, string>> = {}, knownGaps?: StatKey[]) =>
  ({ id, stat, game: "g", extra, ...(knownGaps && { knownGaps }) }) as Reading;
const coveredBy = (map: Record<string, StatKey[]>) => (block: string) => map[block] ?? [];

describe("verifyMap", () => {
  it("is validated by a reading, runtime, or derived", () => {
    const trace = root(node("Sailing", ["ArtifactBonus", 25], [node("TotalStats", ["STR"])]), runtime("Buff"));
    const rows = verifyMap(trace, [reading("r1", "damage")], coveredBy({ Sailing: ["damage"] }));
    expect(rows).toEqual([
      { block: "Sailing", status: "validated", readings: ["r1"] },
      { block: "TotalStats", status: "derived" },
      { block: "Buff", status: "runtime" },
    ]);
  });

  it("lists the readings of every covering stat, in readings order, and none of an uncovered stat", () => {
    const readings = [reading("a", "damage"), reading("b", "coinMulti"), reading("c", "damage"), reading("d", "expMulti")];
    const rows = verifyMap(root(node("Sailing")), readings, coveredBy({ Sailing: ["damage", "expMulti"] }));
    expect(rows).toEqual([{ block: "Sailing", status: "validated", readings: ["a", "c", "d"] }]);
  });

  it("is derived when the covering stat has no reading", () => {
    expect(verifyMap(root(node("Sailing")), [reading("b", "coinMulti")], coveredBy({ Sailing: ["damage"] }))).toEqual([
      { block: "Sailing", status: "derived" },
    ]);
  });

  it("has one row per block, in order of first appearance, and never the root", () => {
    const trace = root(node("B", [], [node("C"), node("A")]), node("A"), node("C"));
    expect(verifyMap(trace, [], coveredBy({})).map((r) => r.block)).toEqual(["B", "C", "A"]);
  });

  it("is runtime only when every appearance is runtime; a cached appearance is a normal one", () => {
    const trace = root(
      runtime("Always"),
      runtime("Always"),
      runtime("Mixed"),
      node("Other", [], [node("Mixed")]),
      runtime("Hit"),
      cached("Hit")
    );
    const status = Object.fromEntries(verifyMap(trace, [], coveredBy({})).map((r) => [r.block, r.status]));
    expect(status).toEqual({ Always: "runtime", Mixed: "derived", Other: "derived", Hit: "derived" });
  });

  it("an assumed value is runtime, whatever readings cover it; it is derived when the block also appears as a normal call", () => {
    const trace = root(assumed("GenINFO[92][14]"), assumed("Both"), node("Both"));
    expect(verifyMap(trace, [reading("r1", "damage")], coveredBy({ "GenINFO[92][14]": ["damage"], Both: ["damage"] }))).toEqual([
      { block: "GenINFO[92][14]", status: "runtime" },
      { block: "Both", status: "validated", readings: ["r1"] },
    ]);
    expect(verifyMap(trace, [], coveredBy({})).map((r) => r.status)).toEqual(["runtime", "derived"]);
  });

  it("a reading validates through its extra values too (maxHp, str...), not only its main stat", () => {
    const readings = [reading("r1", "damage", { maxHp: "1T", str: "9" })];
    const rows = verifyMap(
      root(node("Hp"), node("Str"), node("Acc")),
      readings,
      coveredBy({ Hp: ["maxHp"], Str: ["str", "luk"], Acc: ["accuracy"] })
    );
    expect(rows).toEqual([
      { block: "Hp", status: "validated", readings: ["r1"] },
      { block: "Str", status: "validated", readings: ["r1"] },
      { block: "Acc", status: "derived" }, // r1 has no accuracy value
    ]);
  });

  it("a known gap does not validate: the (reading, stat) pair is skipped, the reading's other values still count", () => {
    const readings = [reading("gap", "damage", { str: "9" }, ["damage"]), reading("ok", "damage")];
    const rows = verifyMap(root(node("Dmg"), node("Str")), readings, coveredBy({ Dmg: ["damage"], Str: ["str"] }));
    expect(rows).toEqual([
      { block: "Dmg", status: "validated", readings: ["ok"] }, // not "gap"
      { block: "Str", status: "validated", readings: ["gap"] },
    ]);
    expect(verifyMap(root(node("Dmg")), [readings[0]], coveredBy({ Dmg: ["damage"] }))).toEqual([{ block: "Dmg", status: "derived" }]);
  });

  it("ignores (absent) leaves: they are no block, at any depth", () => {
    const trace = root(node("Sailing", ["ArtifactBonus", 25], [absent("Lv0[9]"), node("TotalStats", ["STR"])]), absent("Lv0[3]"));
    expect(traceNodes(trace).map((n) => n.block)).toEqual(["Sailing", "TotalStats"]);
    expect(verifyMap(trace, [], coveredBy({})).map((r) => r.block)).toEqual(["Sailing", "TotalStats"]);
  });

  it("a runtime block stays runtime even when a reading covers it", () => {
    expect(verifyMap(root(runtime("Buff")), [reading("r1", "damage")], coveredBy({ Buff: ["damage"] }))).toEqual([
      { block: "Buff", status: "runtime" },
    ]);
  });
});

describe("notPorted", () => {
  // Foo has the game's text; Nope and Void have no N.js slice; every other block has a text without calls.
  const noSlice = new Set(["Nope", "Void"]);
  const text = (n: TraceNode) => (n.block === "Foo" ? `k._customBlock_TotalStats("STR")+k._customBlock_Bar()` : noSlice.has(n.block) ? undefined : "");

  it("reports a game call the node's children lack", () => {
    const trace = root(node("Foo", ["X"], [node("Bar")]));
    expect(notPorted(trace, text)).toEqual([{ block: "Foo", missing: [{ block: "TotalStats", arg0: "STR", args: ["STR"] }] }]);
  });

  it("reports nothing when the children make the call (matching its argument)", () => {
    expect(notPorted(root(node("Foo", [], [node("TotalStats", ["STR"]), node("Bar")])), text)).toEqual([]);
    expect(notPorted(root(node("Foo", [], [node("TotalStats", ["AGI"]), node("Bar")])), text)).toEqual([
      { block: "Foo", missing: [{ block: "TotalStats", arg0: "STR", args: ["STR"] }] },
    ]);
  });

  it("looks at direct children only, counts cached ones, and ignores runtime values named like a block", () => {
    const deep = root(node("Foo", [], [node("Bar", [], [node("TotalStats", ["STR"])])]));
    expect(notPorted(deep, text)).toHaveLength(1);
    expect(notPorted(root(node("Foo", [], [cached("TotalStats", ["STR"]), node("Bar")])), text)).toEqual([]);
    expect(notPorted(root(node("Foo", [], [runtime("TotalStats"), node("Bar")])), text)).toHaveLength(1);
  });

  it("skips assumed nodes like runtime ones: not a ported block to check, not unchecked, and one named like a block covers nothing", () => {
    expect(notPorted(root(node("Foo", [], [assumed("TotalStats"), node("Bar")])), text)).toHaveLength(1);
    expect(notPorted(root(assumed("Nope")), text)).toEqual([]); // no N.js slice, and not reported as unchecked
  });

  it("skips (absent) leaves: neither a missing call nor an unchecked node (they have no N.js slice)", () => {
    const noText = (n: TraceNode) => (n.block === "(absent)" ? undefined : text(n));
    const trace = root(node("Foo", [], [absent("Lv0[9]"), node("TotalStats", ["STR"]), node("Bar")]), absent("OptionsListAccount[7]"));
    expect(notPorted(trace, noText)).toEqual([]);
  });

  it("skips cached and runtime nodes, at any depth", () => {
    const trace = root(cached("Foo"), runtime("Foo"), node("Wrap", [], [node("Foo", ["deep"])]));
    expect(notPorted(trace, text).filter((e) => e.block === "Foo")).toEqual([
      { block: "Foo", missing: [{ block: "TotalStats", arg0: "STR", args: ["STR"] }, { block: "Bar" }] },
    ]);
  });

  it("returns a node with no N.js text as unchecked (never as clean), once per block and arguments", () => {
    const trace = root(node("Nope"), node("Void", [], [node("Foo", ["deep"])]), node("Nope"), node("Nope", [1]));
    expect(notPorted(trace, text)).toEqual([
      { block: "Nope", missing: [], unchecked: true },
      { block: "Void", missing: [], unchecked: true },
      { block: "Foo", missing: [{ block: "TotalStats", arg0: "STR", args: ["STR"] }, { block: "Bar" }] },
      { block: "Nope", missing: [], unchecked: true }, // other arguments: its own entry
    ]);
    expect(notPorted(root(node("Foo", [], [node("TotalStats", ["STR"]), node("Bar")])), text)).toEqual([]); // checked and clean
  });

  it("reports a block and arguments once", () => {
    const trace = root(node("Foo", ["X"]), node("Wrap", [], [node("Foo", ["X"])]), node("Foo", ["Y"]));
    expect(notPorted(trace, text).map((r) => r.block)).toEqual(["Foo", "Foo"]);
  });
});

describe("verifyReport", () => {
  const rows: VerifyRow[] = [
    { block: "Sailing", status: "validated", readings: ["r1", "r2"] },
    { block: "TotalStats", status: "derived" },
    { block: "Summoning", status: "derived" },
    { block: "Buff", status: "runtime" },
  ];
  const ported = [
    { block: "Sailing", missing: [{ block: "TotalStats" }, { block: "Stamp", arg0: 4 }] },
    { block: "TotalStats", missing: [], unchecked: true as const },
    { block: "TotalStats", missing: [], unchecked: true as const },
    { block: "Summoning", missing: [{ block: "Pipe", arg0: "a|b" }] },
  ];
  const head = { stat: "damage" as StatKey, reading: { id: "r1", charName: "Arkhe", map: 150 } as Reading, traced: ["damage"] as StatKey[] };
  const md = verifyReport(head, rows, ported);
  const line = (block: string) => md.split("\n").find((l) => l.startsWith(`| ${block} |`))!;

  it("marks a block with no N.js slice as unchecked in its row, never as an empty (clean) cell", () => {
    expect(line("TotalStats")).toBe("| TotalStats | derived |  | unchecked (no N.js slice) |");
    expect(line("Buff")).toBe("| Buff | runtime |  |  |"); // runtime nodes are skipped, not unchecked
  });

  it("lists the missing calls of a block, and a pipe in a call is escaped", () => {
    expect(line("Sailing")).toBe("| Sailing | validated | r1, r2 | TotalStats, Stamp(4) |");
    expect(line("Summoning")).toBe('| Summoning | derived |  | Pipe("a\\|b") |');
  });

  it("prints the number of unchecked nodes (distinct block+arguments) in the header", () => {
    expect(verifySummary(rows, ported)).toBe(
      "4 blocks: 1 validated, 2 derived, 1 runtime; 2 with N.js calls missing; 2 nodes unchecked (no N.js slice)."
    );
    expect(md).toContain(verifySummary(rows, ported));
    expect(verifySummary(rows, [])).toContain("0 nodes unchecked");
  });
});
