import type { ReactNode } from "react";

// Small info banner shown on the Tome / Drop Rate / Talents pages to explain
// that anonymous players are absent from the top-player comparisons — their
// profiles aren't publicly viewable, so their save can't be computed. Shared
// so the three pages stay visually consistent. It's inline-flex, so wrapping
// it in a `text-center` parent centers it; left-aligned by default.
export default function AnonExcludedNote({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-200/80 ${className}`}
    >
      <span aria-hidden className="leading-tight">
        ℹ️
      </span>
      <span className="leading-tight">
        {children ??
          "Anonymous players are excluded — anonymous profiles have no public save to compute from."}
      </span>
    </div>
  );
}
