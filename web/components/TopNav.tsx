"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; wip?: boolean };

const ITEMS: NavItem[] = [
  { href: "/", label: "🏆 IT Leaderboards" },
  { href: "/tome", label: "📖 Tome Score" },
];

export default function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/75">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1">
        {ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                active
                  ? "border-gold text-gold"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span>{item.label}</span>
              {item.wip && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wide bg-orange-500/20 text-orange-300 border border-orange-500/40 rounded px-1.5 py-0.5"
                  title="Work in progress — algorithm validated, polished UI coming soon"
                >
                  WIP
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
