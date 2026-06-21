// web/app/protest/CopyReportButton.tsx
"use client";

import { useState } from "react";
import { PROTEST } from "@/lib/protest/config";

export default function CopyReportButton() {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(PROTEST.reportText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-md bg-zinc-800 px-6 py-3 text-base font-bold text-zinc-100 transition-colors hover:bg-zinc-700"
    >
      {copied ? "Copied!" : "⧉ Copy report"}
    </button>
  );
}
