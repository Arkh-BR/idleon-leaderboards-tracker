// Converts the breakdown object returned by IT's getDropRate() into a
// tree node structure compatible with the Corgan-style renderer.
//
// Node shape (rendering-agnostic, JSON-safe):
//   { name, val, fmt?, note?, children?: TreeNode[] }
//
// fmt drives how the value is rendered:
//   '+'    → "+12.3" (additive percentage contribution)
//   'x'    → "1.23x" (multiplicative factor)
//   'raw'  → "12.3"  (plain number, no suffix)

export type TreeNodeFmt = "+" | "x" | "raw";

export type TreeNode = {
  name: string;
  val: number;
  fmt?: TreeNodeFmt;
  note?: string;
  children?: TreeNode[];
};

// IT breakdown shape we consume (intentionally loose — IT's typing is `any`)
type ItSource = { name: string; value: number };
type ItSubSection = {
  name?: string;
  totalValue?: string | number;
  sources?: ItSource[];
  subSections?: ItSubSection[];
};
type ItCategory = {
  name: string;
  sources?: ItSource[];
  subSections?: ItSubSection[];
};
type ItBreakdown = {
  statName?: string;
  totalValue?: string | number;
  categories?: ItCategory[];
};

function nz(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Recursively flatten an IT sub-section into renderable children.
function subSectionToNode(s: ItSubSection, fmt: TreeNodeFmt): TreeNode {
  const children: TreeNode[] = [];
  for (const src of s.sources ?? []) {
    if (Math.abs(nz(src.value)) < 1e-9) continue;
    children.push({ name: src.name, val: nz(src.value), fmt });
  }
  for (const sub of s.subSections ?? []) {
    children.push(subSectionToNode(sub, fmt));
  }
  // Total — prefer the IT-provided totalValue when present
  const total = nz(s.totalValue);
  return {
    name: s.name ?? "Subsection",
    val: total,
    fmt,
    children: children.length ? children : undefined,
  };
}

// Build the top-level tree from IT's breakdown plus the final dropRate value.
// We layer an "Arcane Map" multiplier node on top so the user can see how the
// W7 AFK bonus affects the displayed total (see arcaneBonus.ts).
export function buildDropRateTree(
  itBreakdown: ItBreakdown,
  baseDropRate: number,
  arcaneFactorValue: number,
  charLabel: string,
  mapLabel: string
): TreeNode {
  const cats = itBreakdown.categories ?? [];
  const additive = cats.find((c) => c.name?.toLowerCase().includes("additive"));
  const multiplicative = cats.find((c) =>
    c.name?.toLowerCase().includes("multiplicative")
  );

  const children: TreeNode[] = [];

  // 1) Additive pool — every source that gets summed and divided by 100.
  if (additive) {
    const addChildren: TreeNode[] = [];
    for (const src of additive.sources ?? []) {
      if (Math.abs(nz(src.value)) < 1e-9) continue;
      addChildren.push({ name: src.name, val: nz(src.value), fmt: "+" });
    }
    for (const sub of additive.subSections ?? []) {
      addChildren.push(subSectionToNode(sub, "+"));
    }
    const sum = (additive.sources ?? []).reduce(
      (s, src) => s + nz(src.value),
      0
    );
    children.push({
      name: "Additive Sources",
      val: sum,
      fmt: "+",
      note: `1 + (sum / 100) + 1.4 × luck`,
      children: addChildren,
    });
  }

  // 2) Multiplicative chain — each factor applied in IT's documented order.
  if (multiplicative) {
    const mulChildren: TreeNode[] = [];
    for (const src of multiplicative.sources ?? []) {
      if (Math.abs(nz(src.value)) < 1e-9) continue;
      mulChildren.push({ name: src.name, val: nz(src.value), fmt: "x" });
    }
    for (const sub of multiplicative.subSections ?? []) {
      mulChildren.push(subSectionToNode(sub, "x"));
    }
    // Compute the combined multiplicative factor (baseDropRate × ∏ = current)
    children.push({
      name: "Multiplicative Chain",
      val: baseDropRate, // IT folds the chain into this value already
      fmt: "x",
      note: "Tesseract × Card Multi × Glimbo × Tome Multi × Gear × Charm × Companions",
      children: mulChildren,
    });
  }

  // 3) Arcane Map Bonus — only when the user picked a W7 map with kills
  if (arcaneFactorValue > 1.0001) {
    children.push({
      name: `Arcane Map Bonus (${mapLabel})`,
      val: arcaneFactorValue,
      fmt: "x",
      note: "AFK kill count → arcane multiplier (Corgan formula)",
    });
  }

  return {
    name: `Drop Rate — ${charLabel}`,
    val: baseDropRate * arcaneFactorValue,
    fmt: "x",
    children,
  };
}
