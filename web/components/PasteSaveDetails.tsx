"use client";

import { useState } from "react";

// Manual-paste fallback of the tracker pages (private profiles, or a save
// newer than the last IdleonToolbox upload); the compact ProfileNameLoader
// renders it from its `onPaste`. `onLoad` gets the pasted text and says
// whether it loaded; the box is cleared only when it did. `bare` drops the
// <details>/<summary> for a caller that shows and hides it itself (the
// signed-out card's "📋 Paste a save" toggle).
export default function PasteSaveDetails({
  onLoad,
  bare = false,
}: {
  onLoad: (text: string) => boolean;
  bare?: boolean;
}) {
  const [text, setText] = useState("");
  const body = (
    <div className={bare ? "flex flex-col gap-3" : "flex flex-col gap-3 mt-3"}>
      <p className="text-xs text-zinc-500">
        Uses the &ldquo;Copy for Support&rdquo; button on{" "}
        <a
          href="https://idleontoolbox.com"
          target="_blank"
          rel="noreferrer"
          className="text-gold hover:underline"
        >
          idleontoolbox.com
        </a>
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Paste the output of "Copy for Support" here (Ctrl+V)…'
        className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-gold"
      />
      <button
        type="button"
        onClick={() => {
          if (onLoad(text)) setText("");
        }}
        className="self-start px-4 py-1.5 text-sm font-semibold rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30"
      >
        Load pasted save
      </button>
    </div>
  );
  if (bare) return body;
  return (
    <details className="rounded-lg bg-zinc-900/40 p-3 border border-zinc-800">
      <summary className="cursor-pointer select-none flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-gold">📋 Paste a save</span>
        <span className="dt-arrow text-zinc-500 text-sm">▸</span>
      </summary>
      {body}
    </details>
  );
}
