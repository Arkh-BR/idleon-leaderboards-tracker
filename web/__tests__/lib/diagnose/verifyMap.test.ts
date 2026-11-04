import { describe, it, expect } from "vitest";
import { notPorted, verifyMap } from "@/lib/diagnose/verifyMap";
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
const cached = (block: string, args: unknown[] = []) => node(block, args, [], "cached");

const reading = (id: string, stat: StatKey) => ({ id, stat }) as Reading;
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

  it("a runtime block stays runtime even when a reading covers it", () => {
    expect(verifyMap(root(runtime("Buff")), [reading("r1", "damage")], coveredBy({ Buff: ["damage"] }))).toEqual([
      { block: "Buff", status: "runtime" },
    ]);
  });
});

describe("notPorted", () => {
  const text = (n: TraceNode) => (n.block === "Foo" ? `k._customBlock_TotalStats("STR")+k._customBlock_Bar()` : undefined);

  it("reports a game call the node's children lack", () => {
    const trace = root(node("Foo", ["X"], [node("Bar")]));
    expect(notPorted(trace, text)).toEqual([{ block: "Foo", missing: [{ block: "TotalStats", arg0: "STR" }] }]);
  });

  it("reports nothing when the children make the call (matching its argument)", () => {
    expect(notPorted(root(node("Foo", [], [node("TotalStats", ["STR"]), node("Bar")])), text)).toEqual([]);
    expect(notPorted(root(node("Foo", [], [node("TotalStats", ["AGI"]), node("Bar")])), text)).toEqual([
      { block: "Foo", missing: [{ block: "TotalStats", arg0: "STR" }] },
    ]);
  });

  it("looks at direct children only, counts cached ones, and ignores runtime values named like a block", () => {
    const deep = root(node("Foo", [], [node("Bar", [], [node("TotalStats", ["STR"])])]));
    expect(notPorted(deep, text)).toHaveLength(1);
    expect(notPorted(root(node("Foo", [], [cached("TotalStats", ["STR"]), node("Bar")])), text)).toEqual([]);
    expect(notPorted(root(node("Foo", [], [runtime("TotalStats"), node("Bar")])), text)).toHaveLength(1);
  });

  it("skips nodes with no N.js text, cached nodes and runtime nodes, at any depth", () => {
    const trace = root(node("Nope"), cached("Foo"), runtime("Foo"), node("Wrap", [], [node("Foo", ["deep"])]));
    expect(notPorted(trace, text)).toEqual([{ block: "Foo", missing: [{ block: "TotalStats", arg0: "STR" }, { block: "Bar" }] }]);
  });

  it("reports a block and arguments once", () => {
    const trace = root(node("Foo", ["X"]), node("Wrap", [], [node("Foo", ["X"])]), node("Foo", ["Y"]));
    expect(notPorted(trace, text).map((r) => r.block)).toEqual(["Foo", "Foo"]);
  });
});
