// web/app/protest/page.tsx
import type { Metadata } from "next";
import { PROTEST } from "@/lib/protest/config";
import CopyReportButton from "./CopyReportButton";

export const metadata: Metadata = {
  title: { absolute: "We're on strike — Arkh's Idleon Trackers" },
  robots: { index: false, follow: false },
};

// Caution-tape stripes (no native Tailwind util for repeating gradients).
const STRIPES: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, #f59e0b, #f59e0b 14px, #18181b 14px, #18181b 28px)",
};

export default function ProtestPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="h-3.5 rounded-sm" style={STRIPES} />

      <header className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="text-5xl">📢</div>
        <h1 className="text-3xl font-extrabold tracking-wide text-amber-400 sm:text-4xl">
          {PROTEST.headline}
        </h1>
        <p className="max-w-xl leading-relaxed text-zinc-300">{PROTEST.subhead}</p>
      </header>

      <section className="mb-5 rounded-lg border border-zinc-800 border-l-4 border-l-red-500 bg-zinc-900 p-5">
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-red-500">
          ⚠ What&rsquo;s broken
        </h2>
        {PROTEST.whatsBroken.map((line, i) => (
          <p key={i} className="mb-2 text-sm leading-relaxed text-zinc-300 last:mb-0">
            {line}
          </p>
        ))}
      </section>

      <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-xs font-extrabold uppercase tracking-wide text-gold">
          ✊ Help get it fixed
        </h2>
        <ol className="mb-4 flex flex-col gap-3">
          {PROTEST.steps.map((step, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-gold text-[11px] font-extrabold text-zinc-950">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <pre className="whitespace-pre-wrap rounded-md border border-dashed border-zinc-700 bg-zinc-950 p-3 font-mono text-[12px] leading-relaxed text-zinc-400">
{PROTEST.reportText}
        </pre>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <CopyReportButton />
          <a
            href={PROTEST.discordInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-[#5865F2] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#4752c4]"
          >
            Report on Discord →
          </a>
        </div>
      </section>

      <div className="h-3.5 rounded-sm" style={STRIPES} />
    </main>
  );
}
