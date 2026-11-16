import { useId } from "react";

/** A titled dashboard block; the heading names the region (tests and screen readers find it by title). */
export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-base font-semibold text-zinc-100">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** First column left-aligned (the board), the rest mono. */
export function Table({ headers, rows, empty }: { headers: string[]; rows: { key: string; cells: React.ReactNode[] }[]; empty: string }) {
  if (!rows.length) return <div className="rounded-lg border border-zinc-800 px-3 py-4 text-sm italic text-zinc-500">{empty}</div>;
  return (
    <div className="max-h-[32rem] overflow-auto rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-zinc-900 text-left text-xs text-zinc-400">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-zinc-800 bg-zinc-950">
              {r.cells.map((c, i) => (
                <td key={i} className={`whitespace-nowrap px-3 py-2 ${i === 0 ? "text-zinc-100" : "font-mono text-zinc-300"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
