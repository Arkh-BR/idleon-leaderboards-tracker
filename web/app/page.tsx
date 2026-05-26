import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Arkh's Idleon Trackers",
  },
  description:
    "Community trackers for Legends of Idleon — IT leaderboards rank monitor, local Tome Score calculator, and Drop Rate breakdown.",
};

export default function HomePage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-12 sm:py-20">
      <header className="text-center mb-12 sm:mb-16">
        <h1 className="text-4xl sm:text-5xl font-bold text-gold mb-3 tracking-tight">
          Arkh&rsquo;s Idleon Trackers
        </h1>
        <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto">
          Community tools for Legends of Idleon. No accounts, no servers,
          your data stays in your browser.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <ShortcutCard
          href="/leaderboards"
          icon="🏆"
          title="IT Leaderboards Tracker"
          description="See your rank across all 153 IdleonToolbox leaderboards in one place. Live data, cached 15 min."
          cta="Open Leaderboards"
        />
        <ShortcutCard
          href="/tome"
          icon="📖"
          title="Tome Score Tracker"
          description="Paste your raw IT save JSON and compute the full 118-task Tome Score offline. Compare vs top players, track gains over time."
          cta="Open Tome Score"
        />
        <ShortcutCard
          href="/drop-rate"
          icon="🎲"
          title="Drop Rate Tracker"
          description="N.js-faithful breakdown of every Drop Rate source on your save. Per-character, per-map, with snapshot diffing."
          cta="Open Drop Rate"
        />
      </div>

      <footer className="mt-16 text-xs text-zinc-600 text-center border-t border-zinc-900 pt-4">
        Source code:{" "}
        <a
          href="https://github.com/Arkh-BR/idleon-leaderboards-tracker"
          className="text-zinc-400 hover:text-gold"
          target="_blank"
          rel="noreferrer"
        >
          Arkh-BR/idleon-leaderboards-tracker
        </a>{" "}
        · Game data from{" "}
        <a
          href="https://idleontoolbox.com"
          className="text-zinc-400 hover:text-gold"
          target="_blank"
          rel="noreferrer"
        >
          idleontoolbox.com
        </a>
      </footer>
    </main>
  );
}

function ShortcutCard({
  href,
  icon,
  title,
  description,
  cta,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-6 transition-all hover:border-gold/50 hover:from-zinc-900 hover:to-zinc-900/60 hover:shadow-lg hover:shadow-gold/5"
    >
      <div className="text-5xl mb-4">{icon}</div>
      <h2 className="text-xl font-bold text-zinc-100 mb-2 group-hover:text-gold transition-colors">
        {title}
      </h2>
      <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
        {description}
      </p>
      <div className="text-sm font-semibold text-gold flex items-center gap-1">
        {cta}
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}
