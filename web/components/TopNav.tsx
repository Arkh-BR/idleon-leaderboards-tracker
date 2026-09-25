"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PROTEST_MODE } from "@/lib/protest/config";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; items: NavLink[] };
type NavEntry = NavLink | NavGroup;

const TRACKERS: NavGroup = {
  label: "📈 Trackers",
  items: [
    { href: "/drop-rate", label: "🎲 Drop Rate" },
    { href: "/coin-multi", label: "🪙 Coin Multi" },
    { href: "/exp-multi", label: "✨ EXP Multi" },
    { href: "/afk-gains", label: "💤 AFK Gains" },
    { href: "/multikill", label: "💥 Multikill" },
  ],
};

const ENTRIES: NavEntry[] = [
  { href: "/leaderboards", label: "🏆 IT Leaderboards" },
  { href: "/tome", label: "📖 Tome Score" },
  TRACKERS,
  { href: "/talents-level", label: "🌟 Talents" },
  { href: "/cooking-mastery", label: "🍳 Cooking Mastery" },
  { href: "/sheets", label: "📊 Sheets & Tools" },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

const tabClass = (active: boolean) =>
  `shrink-0 whitespace-nowrap px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
    active ? "border-gold text-gold" : "border-transparent text-zinc-400 hover:text-zinc-200"
  }`;

export default function TopNav() {
  const pathname = usePathname();
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  // Whether there is hidden, scrollable content on each side. Drives the edge
  // fades so they only show when the bar actually overflows (i.e. mobile).
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  // The Trackers menu's left offset inside the nav, or null when closed. The
  // menu sits outside the scroll strip: overflow-x-auto would clip it.
  const [menuLeft, setMenuLeft] = useState<number | null>(null);
  const open = menuLeft !== null;

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setAtStart(scrollLeft <= 1);
    setAtEnd(scrollLeft + clientWidth >= scrollWidth - 1);
  }, []);

  const close = useCallback(() => setMenuLeft(null), []);

  const toggle = () => {
    if (open) return close();
    const b = buttonRef.current?.getBoundingClientRect();
    const w = wrapRef.current?.getBoundingClientRect();
    setMenuLeft(b && w ? b.left - w.left : 0);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();
    const onScroll = () => {
      updateEdges();
      close(); // the menu is anchored to where the button was
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // ResizeObserver catches viewport changes, rotation, and late font loads
    // (which all change scrollWidth) without a manual resize listener.
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [updateEdges, close]);

  // Navigating closes the menu.
  useEffect(close, [pathname, close]);

  // Click outside or Escape closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Protest mode: hide the whole nav so every tool is unreachable from here.
  // Placed after the hooks above so their call order stays stable.
  if (PROTEST_MODE) return null;

  const trackersActive = TRACKERS.items.some((i) => isActive(pathname, i.href));

  return (
    <nav className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/75">
      <div ref={wrapRef} className="relative max-w-7xl mx-auto">
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

        <div ref={scrollRef} className="flex items-center gap-1 overflow-x-auto no-scrollbar px-2 sm:px-4">
          {ENTRIES.map((entry) =>
            "items" in entry ? (
              <button
                key={entry.label}
                ref={buttonRef}
                type="button"
                aria-haspopup="true"
                aria-expanded={open}
                aria-controls="nav-trackers-menu"
                onClick={toggle}
                className={tabClass(trackersActive)}
              >
                {entry.label} <span aria-hidden>{open ? "▴" : "▾"}</span>
              </button>
            ) : (
              <Link key={entry.href} href={entry.href} className={tabClass(isActive(pathname, entry.href))}>
                {entry.label}
              </Link>
            )
          )}
        </div>

        {open && (
          <ul
            id="nav-trackers-menu"
            ref={menuRef}
            style={{ left: menuLeft ?? 0 }}
            className="absolute top-full z-40 mt-px min-w-[12rem] rounded-b-md border border-zinc-800 bg-zinc-950 py-1 shadow-lg shadow-black/40"
          >
            {TRACKERS.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={`block whitespace-nowrap px-4 py-2 text-sm ${
                      active ? "text-gold bg-zinc-900" : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}
