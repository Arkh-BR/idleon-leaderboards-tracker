"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  value: string;
  onPick(name: string): void;
  chips?: { label: string; name: string }[];
  label?: string; // input label (sr-only)
  button?: string; // submit button text
  busy?: boolean; // disables submit and shows "Loading…"
};

/** Name input with a 300 ms debounced `/api/lb/names` autocomplete (2+ chars), keyboard listbox, and optional chips. */
export default function PlayerPicker({ value, onPick, chips, label = "Player name", button = "Load", busy = false }: Props) {
  const id = useId();
  const [text, setText] = useState(value);
  const [list, setList] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef<string | null>(null); // the query whose answer may still land

  useEffect(() => setText(value), [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const close = () => {
    clearTimeout(timer.current);
    latest.current = null;
    setList([]);
    setHi(-1);
  };

  const pick = (raw: string) => {
    const n = raw.trim();
    if (!n) return;
    close();
    setText(n);
    onPick(n);
  };

  const type = (v: string) => {
    setText(v);
    close();
    const q = v.trim();
    if (q.length < 2) return;
    timer.current = setTimeout(async () => {
      latest.current = q;
      try {
        const r = await fetch(`/api/lb/names?q=${encodeURIComponent(q)}`);
        const body = await r.json();
        if (latest.current !== q) return; // stale: the user kept typing or picked
        setList(r.ok && Array.isArray(body?.players) ? body.players.slice(0, 10) : []);
        setHi(-1);
      } catch {
        /* no suggestions: typing still works */
      }
    }, 300);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && list.length) {
      e.preventDefault();
      setHi((i) => (i + 1) % list.length);
    } else if (e.key === "ArrowUp" && list.length) {
      e.preventDefault();
      setHi((i) => (i <= 0 ? list.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(hi >= 0 ? list[hi] : text);
    } else if (e.key === "Escape") {
      close();
    }
  };

  const open = list.length > 0;
  return (
    <div className="flex min-w-[240px] flex-1 flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          pick(text);
        }}
        className="flex gap-2"
      >
        <label htmlFor={`${id}-in`} className="sr-only">
          {label}
        </label>
        <div className="relative min-w-0 flex-1">
          <input
            id={`${id}-in`}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={hi >= 0 ? `${id}-o${hi}` : undefined}
            autoComplete="off"
            value={text}
            onChange={(e) => type(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={close}
            placeholder={label}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm"
          />
          {open && (
            <ul
              id={`${id}-list`}
              role="listbox"
              aria-label={`${label} suggestions`}
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded border border-zinc-700 bg-zinc-900 py-1 text-sm shadow-lg"
            >
              {list.map((n, i) => (
                <li
                  key={n}
                  id={`${id}-o${i}`}
                  role="option"
                  aria-selected={i === hi}
                  onMouseDown={(e) => e.preventDefault()} // keep focus so onBlur doesn't close before the click
                  onClick={() => pick(n)}
                  className={`cursor-pointer px-3 py-1 font-mono ${i === hi ? "bg-emerald-900/50 text-emerald-200" : "text-zinc-300 hover:bg-zinc-800"}`}
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Loading…" : button}
        </button>
      </form>
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.name.toLowerCase()}
              type="button"
              onClick={() => pick(c.name)}
              className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-0.5 text-xs text-zinc-300 hover:border-emerald-600 hover:text-emerald-200"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
