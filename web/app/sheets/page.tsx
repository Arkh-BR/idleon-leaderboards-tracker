import type { Metadata } from "next";
import {
  mySheets,
  communitySheets,
  communitySites,
  type SheetLink,
} from "@/lib/sheets";

export const metadata: Metadata = {
  title: "Sheets",
  description:
    "A curated hub of Idleon spreadsheets and sites — the ones I maintain plus community sheets and tools worth bookmarking.",
};

export default function SheetsPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📊</span>
          <h1 className="text-2xl font-bold text-gold">Sheets</h1>
        </div>
        <p className="text-zinc-400 text-sm max-w-2xl">
          A hub of useful Idleon spreadsheets and sites — the ones I maintain,
          plus community sheets and tools worth bookmarking. Links open in a new
          tab.
        </p>
      </header>

      <SheetSection
        icon="⭐"
        title="My Sheets"
        subtitle="Spreadsheets I build and keep up to date."
        sheets={mySheets}
      />

      <SheetSection
        icon="🌐"
        title="Community Sheets"
        subtitle="Great sheets made by other players. Full credit to their authors."
        sheets={communitySheets}
      />

      <SheetSection
        icon="🔗"
        title="Community Sites"
        subtitle="Useful tools, wikis and dashboards from the wider Idleon community."
        sheets={communitySites}
        cta="Open site"
      />

      <footer className="mt-12 text-xs text-zinc-600 text-center border-t border-zinc-900 pt-4">
        Source code:{" "}
        <a
          href="https://github.com/Arkh-BR/idleon-leaderboards-tracker"
          className="text-zinc-400 hover:text-gold"
          target="_blank"
          rel="noreferrer"
        >
          Arkh-BR/idleon-leaderboards-tracker
        </a>
      </footer>
    </main>
  );
}

function SheetSection({
  icon,
  title,
  subtitle,
  sheets,
  cta = "Open sheet",
}: {
  icon: string;
  title: string;
  subtitle: string;
  sheets: SheetLink[];
  cta?: string;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
        <span className="text-xs text-zinc-500">({sheets.length})</span>
      </div>
      <p className="text-sm text-zinc-500 mb-4">{subtitle}</p>

      {sheets.length === 0 ? (
        <p className="text-sm text-zinc-600 italic rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-center">
          No sheets here yet.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sheets.map((sheet) => (
            <SheetCard key={sheet.url} sheet={sheet} cta={cta} />
          ))}
        </div>
      )}
    </section>
  );
}

function SheetCard({ sheet, cta }: { sheet: SheetLink; cta: string }) {
  return (
    <a
      href={sheet.url}
      target="_blank"
      rel="noreferrer"
      className="group block rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-5 transition-all hover:border-gold/50 hover:from-zinc-900 hover:to-zinc-900/60 hover:shadow-lg hover:shadow-gold/5"
    >
      <h3 className="text-base font-bold text-zinc-100 mb-1 group-hover:text-gold transition-colors">
        {sheet.name}
      </h3>
      {sheet.author && (
        <p className="text-xs text-zinc-500 mb-2">by {sheet.author}</p>
      )}
      {sheet.description && (
        <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
          {sheet.description}
        </p>
      )}
      <div className="text-sm font-semibold text-gold flex items-center gap-1">
        {cta}
        <span className="transition-transform group-hover:translate-x-1">↗</span>
      </div>
    </a>
  );
}
