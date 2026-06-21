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
    "repeating-linear-gradient(45deg, #f59e0b, #f59e0b 16px, #18181b 16px, #18181b 32px)",
};

export default function ProtestPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="h-5 rounded-sm" style={STRIPES} />

      <header className="flex flex-col items-center gap-5 py-12 text-center">
        <div className="text-7xl">📢</div>
        <h1 className="text-4xl font-extrabold tracking-wide text-amber-400 sm:text-6xl">
          {PROTEST.headline}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-zinc-300 sm:text-xl">
          {PROTEST.subhead}
        </p>
      </header>

      <section className="mb-6 rounded-lg border border-zinc-800 border-l-4 border-l-red-500 bg-zinc-900 p-6 sm:p-7">
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-red-500">
          ⚠ What&rsquo;s broken
        </h2>
        {PROTEST.whatsBroken.map((line, i) => (
          <p
            key={i}
            className="mb-3 text-base leading-relaxed text-zinc-300 last:mb-0 sm:text-lg"
          >
            {line}
          </p>
        ))}
      </section>

      <section className="mb-7 rounded-lg border border-zinc-800 bg-zinc-900 p-6 sm:p-7">
        <h2 className="mb-5 text-sm font-extrabold uppercase tracking-wide text-gold">
          ✊ Help get it fixed
        </h2>
        <ol className="mb-5 flex flex-col gap-4">
          {PROTEST.steps.map((step, i) => (
            <li
              key={i}
              className="flex items-center gap-4 text-base text-zinc-300 sm:text-lg"
            >
              <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-gold text-base font-extrabold text-zinc-950">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <pre className="whitespace-pre-wrap rounded-md border border-dashed border-zinc-700 bg-zinc-950 p-4 font-mono text-sm leading-relaxed text-zinc-400 sm:text-base">
{PROTEST.reportText}
        </pre>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <CopyReportButton />
          <a
            href={PROTEST.discordInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-[#5865F2] px-6 py-3 text-base font-bold text-white transition-colors hover:bg-[#4752c4]"
          >
            Report on Discord →
          </a>
        </div>
      </section>

      <div className="h-5 rounded-sm" style={STRIPES} />
    </main>
  );
}
