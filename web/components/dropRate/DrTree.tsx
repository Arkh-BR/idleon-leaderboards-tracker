"use client";

import { useState } from "react";
import type { TreeNode, TreeNodeFmt } from "@/lib/dropRate/treeBuilder";

function formatVal(val: number, fmt: TreeNodeFmt | undefined): string {
  if (!Number.isFinite(val)) return "—";
  if (fmt === "x") return val.toFixed(2) + "x";
  if (fmt === "+") return (val >= 0 ? "+" : "") + val.toFixed(2);
  // raw
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(2) + "M";
  if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(2) + "K";
  return val.toFixed(2);
}

function valColor(val: number, fmt: TreeNodeFmt | undefined): string {
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

type RowProps = {
  node: TreeNode;
  depth: number;
  isRoot?: boolean;
};

function TreeRow({ node, depth, isRoot }: RowProps) {
  // Roots & first-level pools default to expanded; deeper levels collapsed
  // ("show me the summary, drill in on demand" default).
  const [open, setOpen] = useState(depth < 2);

  const hasChildren = !!(node.children && node.children.length);
  const arrow = hasChildren ? (open ? "▾" : "▸") : "";

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2 py-1 border-b border-white/5 ${
          isRoot ? "font-bold text-base border-b-2 border-zinc-700 pt-2 pb-2" : "text-sm"
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
      </div>
      {open && hasChildren && (
        <div className="bg-black/20 border-l-2 border-white/5">
          {node.children!.map((c, i) => (
            <TreeRow key={`${depth}-${i}-${c.name}`} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DrTree({ tree }: { tree: TreeNode | null }) {
  if (!tree) {
    return (
      <p className="text-sm text-zinc-500 italic">
        Load a save above to compute the breakdown.
      </p>
    );
  }
  return (
    <div className="font-sans">
      <TreeRow node={tree} depth={0} isRoot />
    </div>
  );
}
