"use client";

// Debug-only (`?debug=1`): type what the game shows for this stat, download the
// save + reading as a bundle, and `npx tsx scripts/readings/import.ts <bundle>`
// turns it into a regression test (lib/readings). Nothing renders otherwise.

import { useEffect, useState } from "react";
import { INTERMEDIATES } from "@/lib/readings/catalog";
import { stripEnvelope } from "@/lib/readings/envelope";
import type { Reading, StatKey } from "@/lib/readings/types";

type Props = {
  stat: StatKey;
  /** The stat's name on the page ("Damage"), the main field's label. */
  label: string;
  save: unknown;
  charIdx: number;
  charName: string;
  /** The map the calculator computed on. */
  mapIdx: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

export default function RecordReading({ stat, label, save, charIdx, charName, mapIdx }: Props) {
  // Read after mount: the server and the first client render stay empty.
  const [debug, setDebug] = useState(false);
  const [open, setOpen] = useState(false);
  const [game, setGame] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  useEffect(() => setDebug(new URLSearchParams(window.location.search).get("debug") === "1"), []);
  if (!debug) return null;

  function download() {
    const now = new Date();
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
    const slug = charName.replace(/[^\w-]+/g, "-");
    const saved = new Date((save as { lastUpdated?: number }).lastUpdated ?? NaN);
    const typed = Object.entries(extra).filter(([, v]) => v.trim());
    const reading: Omit<Reading, "saveFile" | "saveSha1"> = {
      id: `${stamp}-${stat}-${slug.toLowerCase()}`,
      stat,
      charIdx,
      charName,
      map: mapIdx,
      capturedAt: (isNaN(saved.getTime()) ? now : saved).toISOString(),
      game: game.trim(),
      ...(typed.length && { extra: Object.fromEntries(typed.map(([k, v]) => [k, v.trim()])) }),
    };
    const bundle = { reading, envelope: stripEnvelope(save as object) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reading-${stat}-${slug}-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const field = (name: string, value: string, set: (v: string) => void) => (
    <label key={name} className="flex items-center gap-2">
      <span className="w-24 text-zinc-400">{name}</span>
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sky-300"
      />
    </label>
  );

  return (
    <div className="text-xs">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-zinc-500 underline">
        Record in-game reading
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-zinc-500">Type exactly what the game shows</p>
          {field(label, game, setGame)}
          {INTERMEDIATES[stat].map((k) => field(k, extra[k] ?? "", (v) => setExtra({ ...extra, [k]: v })))}
          <button
            type="button"
            disabled={!game.trim()}
            onClick={download}
            className="self-start px-2 py-1 border border-zinc-700 rounded text-zinc-300 disabled:opacity-40"
          >
            Download
          </button>
        </div>
      )}
    </div>
  );
}
