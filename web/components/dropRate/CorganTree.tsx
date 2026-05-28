"use client";

import { useState } from "react";
import type { CorganNode } from "@/lib/corgan/node";
import {
  nodePath,
  type FlatTree,
} from "@/lib/dropRate/treeFlatten";

// Idleon-style suffixed number — M/B/T/Q/QQ/QQQ, then scientific past 1e24
// (toFixed emits exponent strings past ~1e21, which produced "3.7e+34B" when
// only B existed and bigger numbers were divided by 1e9).
function suffixed(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1e24) return val.toExponential(2);
  if (abs >= 1e21) return (val / 1e21).toFixed(2) + "QQQ";
  if (abs >= 1e18) return (val / 1e18).toFixed(2) + "QQ";
  if (abs >= 1e15) return (val / 1e15).toFixed(2) + "Q";
  if (abs >= 1e12) return (val / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (val / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (val / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (val / 1e3).toFixed(2) + "K";
  return val.toFixed(3);
}

/** Drop trailing zeros (and a bare trailing dot) from a fixed string. */
function trimZeros(s: string): string {
  return s.indexOf(".") >= 0 ? s.replace(/\.?0+$/, "") : s;
}

function formatVal(val: number, fmt: string | undefined): string {
  if (!Number.isFinite(val)) return "—";
  // Multipliers compound into the final DR — show real precision (6 dp,
  // trimmed) for normal-range multis instead of rounding 1.26974 → 1.270.
  if (fmt === "x") {
    const a = Math.abs(val);
    if (a >= 1e21) return val.toExponential(2) + "x";
    return trimZeros(val.toFixed(a < 1000 ? 6 : 3)) + "x";
  }
  if (fmt === "+")
    return (
      (val >= 0 ? "+" : "") +
      (Math.abs(val) >= 1e21 ? val.toExponential(2) : val.toFixed(3))
    );
  if (fmt === "%") return val.toFixed(2) + "%";
  return suffixed(val);
}

/** Format the delta column. For multiplicative fmt 'x' we show the delta in
 *  absolute multi units (e.g. +0.012x). For raw/+/% we show the raw delta. */
function formatDelta(delta: number, fmt: string | undefined): string {
  if (!Number.isFinite(delta)) return "—";
  if (Math.abs(delta) < 1e-6) return "0";
  const sign = delta > 0 ? "+" : "";
  if (fmt === "x") return sign + delta.toFixed(3) + "x";
  if (Math.abs(delta) >= 1e6) return sign + (delta / 1e6).toFixed(2) + "M";
  if (Math.abs(delta) >= 1e3) return sign + (delta / 1e3).toFixed(2) + "K";
  return sign + delta.toFixed(3);
}

function valColor(val: number, fmt: string | undefined): string {
  if (fmt === "+") {
    if (val > 0) return "text-emerald-300";
    if (val < 0) return "text-red-300";
    return "text-zinc-500";
  }
  if (fmt === "x") {
    if (val > 1.001) return "text-amber-300";
    if (val < 0.999) return "text-red-300";
    return "text-zinc-300";
  }
  return "text-zinc-200";
}

function deltaColor(delta: number | null): string {
  if (delta === null) return "text-zinc-600";
  if (Math.abs(delta) < 1e-6) return "text-zinc-600";
  if (delta > 0) return "text-emerald-400";
  return "text-red-400";
}

type RowProps = {
  node: CorganNode;
  depth: number;
  isRoot?: boolean;
  parentPath: string;
  siblings: CorganNode[];
  index: number;
  baseline: FlatTree | null;
};

function TreeRow({
  node,
  depth,
  isRoot,
  parentPath,
  siblings,
  index,
  baseline,
}: RowProps) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = !!(node.children && node.children.length);
  const arrow = hasChildren ? (open ? "▾" : "▸") : "";

  // Compute the path + delta for this node (if baseline provided)
  const path = nodePath(parentPath, node, siblings, index);
  const baselineVal = baseline ? baseline[path] : undefined;
  const delta =
    baseline && typeof baselineVal === "number"
      ? Number(node.val) - baselineVal
      : null;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2 py-1 border-b border-white/5 ${
          isRoot
            ? "font-bold text-base border-b-2 border-zinc-700 pt-2 pb-2"
            : "text-sm"
        } ${hasChildren ? "cursor-pointer hover:bg-white/5" : ""}`}
        style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
        onClick={() => hasChildren && setOpen(!open)}
        title={node.note}
      >
        <span className="w-4 text-zinc-500 select-none flex-shrink-0">{arrow}</span>
        <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis text-zinc-200">
          {node.name}
          {node.note && (
            <span className="ml-2 text-[10px] text-zinc-500 italic">
              {node.note}
            </span>
          )}
        </span>
        <span
          className={`font-mono tabular-nums text-right ${valColor(node.val, node.fmt)} ${
            isRoot ? "text-lg" : ""
          }`}
        >
          {formatVal(node.val, node.fmt)}
        </span>
        {baseline && (
          <span
            className={`font-mono tabular-nums text-right text-xs w-24 ${deltaColor(
              delta
            )}`}
            title={
              delta !== null
                ? `baseline = ${formatVal(baselineVal as number, node.fmt)}`
                : "node not present in baseline snapshot"
            }
          >
            {delta === null
              ? <span className="text-zinc-700">—</span>
              : formatDelta(delta, node.fmt)}
          </span>
        )}
      </div>
      {open && hasChildren && (
        <div className="bg-black/20 border-l-2 border-white/5">
          {node.children!.map((c, i) => (
            <TreeRow
              key={`${depth}-${i}-${c.name}`}
              node={c}
              depth={depth + 1}
              parentPath={path}
              siblings={node.children!}
              index={i}
              baseline={baseline}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CorganTree({
  tree,
  baseline,
}: {
  tree: CorganNode | null;
  baseline?: FlatTree | null;
}) {
  if (!tree) {
    return (
      <p className="text-sm text-zinc-500 italic">
        Load a save above to compute the drop rate breakdown.
      </p>
    );
  }
  return (
    <div className="font-sans">
      {baseline && (
        <div className="flex items-center gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
          <span className="w-4" />
          <span className="flex-1">Node</span>
          <span className="text-right">Current</span>
          <span className="text-right w-24">Δ vs snap</span>
        </div>
      )}
      <TreeRow
        node={tree}
        depth={0}
        isRoot
        parentPath=""
        siblings={[tree]}
        index={0}
        baseline={baseline ?? null}
      />
    </div>
  );
}
