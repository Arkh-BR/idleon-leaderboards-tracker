"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type NavItem = { href: string; label: string };

const ITEMS: NavItem[] = [
  { href: "/leaderboards", label: "🏆 IT Leaderboards" },
  { href: "/tome", label: "📖 Tome Score" },
  { href: "/drop-rate", label: "🎲 Drop Rate" },
  { href: "/talents-level", label: "🌟 Talents" },
  { href: "/sheets", label: "📊 Sheets & Tools" },
];

export default function TopNav() {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether there is hidden, scrollable content on each side. Drives the edge
  // fades so they only show when the bar actually overflows (i.e. mobile).
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setAtStart(scrollLeft <= 1);
    setAtEnd(scrollLeft + clientWidth >= scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    // ResizeObserver catches viewport changes, rotation, and late font loads
    // (which all change scrollWidth) without a manual resize listener.
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      ro.disconnect();
    };
  }, [updateEdges]);

  return (
    <nav className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/75">
      <div className="relative max-w-7xl mx-auto">
        {/* Left fade — shown once you've scrolled away from the start. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-zinc-950 to-transparent transition-opacity duration-200 ${
            atStart ? "opacity-0" : "opacity-100"
          }`}
        />
        {/* Right fade + chevron — shown while more tabs remain off-screen. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center justify-end pl-6 pr-2 bg-gradient-to-l from-zinc-950 via-zinc-950/90 to-transparent transition-opacity duration-200 ${
            atEnd ? "opacity-0" : "opacity-100"
          }`}
        >
          <span className="text-zinc-400 text-sm">›</span>
        </div>

        <div
          ref={scrollRef}
          className="flex items-center gap-1 overflow-x-auto no-scrollbar px-2 sm:px-4"
        >
          {ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-gold text-gold"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
