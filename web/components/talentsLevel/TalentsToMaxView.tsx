"use client";

// ============================================================================
// TalentsToMaxView — "Faltando p/ Max" tab for the Talents Level page.
//
// Renders the account-wide scan from lib/talentsLevel/toMax.ts: one
// collapsible section per character, listing the regular talents still
// below their Max Book Lv Cap (sorted by largest gap). Each row shows the
// level invested in BOTH presets (P1 / P2) against the shared cap; the
// preset active in-game is flagged with a ● dot. Chars already fully at the
// cap (both presets) are summarized in a small footer line.
//
// Pure presentation — all the math lives in computeTalentsToMax(); this
// component just receives the precomputed groups + a loading flag.
// ============================================================================

import { useState } from "react";
import type { ToMaxCharGroup, ToMaxItem } from "@/lib/talentsLevel/toMax";

export default function TalentsToMaxView({
  groups,
  loading,
}: {
  groups: ToMaxCharGroup[] | null;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-zinc-500 italic px-2 py-4">Computando…</p>;
  }
  if (!groups) {
    return (
      <p className="text-sm text-zinc-500 italic px-2 py-4">
        Carregue um save acima para escanear os talentos da conta.
      </p>
    );
  }

  const pending = groups.filter((g) => g.items.length > 0);
  const complete = groups.filter((g) => g.items.length === 0);
  const totalMissing = pending.reduce((a, g) => a + g.items.length, 0);

  if (totalMissing === 0) {
    return (
      <p className="text-sm text-emerald-300 px-2 py-4">
        🎉 Todos os talentos (tab 1-5) de todos os personagens estão no Max
        Book Lv Cap, nos dois presets.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Resumo geral */}
      <div className="text-xs text-zinc-400 px-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          <span className="text-gold font-semibold">{totalMissing}</span>{" "}
          talento{totalMissing === 1 ? "" : "s"} abaixo do cap em{" "}
          <span className="text-zinc-200 font-semibold">{pending.length}</span>{" "}
          personagem{pending.length === 1 ? "" : "s"} (em algum preset).
        </span>
        <span className="text-[11px] text-zinc-500">
          P1/P2 = preset 1 / preset 2 · <span className="text-sky-300">●</span>{" "}
          = ativo in-game
        </span>
      </div>

      {pending.map((g) => (
        <CharSection key={g.charIdx} group={g} />
      ))}

      {complete.length > 0 && (
        <div className="text-[11px] text-zinc-500 px-1 pt-1 border-t border-zinc-900">
          ✓ {complete.length} personagem{complete.length === 1 ? "" : "s"} já no
          cap (ambos presets):{" "}
          <span className="text-zinc-400">
            {complete.map((g) => g.charName).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

function CharSection({ group }: { group: ToMaxCharGroup }) {
  const [open, setOpen] = useState(true);
  const atCap = group.totalScanned - group.items.length;
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-3 py-2.5 text-base font-semibold text-sky-300 flex items-center gap-2.5 hover:bg-white/5 rounded-t-lg ${
          open ? "border-b border-zinc-800" : ""
        }`}
        title={open ? "Recolher" : "Expandir"}
      >
        <span className="w-3 text-zinc-500 select-none text-sm">
          {open ? "▾" : "▸"}
        </span>
        <span className="truncate">{group.charName}</span>
        <span className="text-[11px] text-zinc-500 font-normal">
          {group.classLabel} · Lv {group.level} · Preset{" "}
          {group.activePreset + 1} ativo
        </span>
        <span className="ml-auto text-[11px] text-zinc-500 font-normal">
          <span className="text-amber-300 font-semibold">
            {group.items.length}
          </span>{" "}
          faltando · {atCap}/{group.totalScanned} no cap
        </span>
      </button>
      {open && (
        <div>
          {group.items.map((it) => (
            <TalentRow
              key={it.talentId}
              item={it}
              activePreset={group.activePreset}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TalentRow({
  item,
  activePreset,
}: {
  item: ToMaxItem;
  activePreset: 0 | 1;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800/60 last:border-b-0 hover:bg-white/5">
      <img
        src={`/talent-icons/UISkillIcon${item.talentId}.png`}
        alt={item.name}
        className="w-8 h-8 object-contain flex-shrink-0"
        style={{ imageRendering: "pixelated" }}
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-zinc-200 truncate font-medium">
            {item.name}
          </span>
          {item.accountWide && (
            <span
              className="text-[9px] leading-none px-1 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono flex-shrink-0"
              title="Talento account-wide (🌐): o bônus vem do char de maior nível da classe"
            >
              🌐
            </span>
          )}
          <span className="text-[9px] text-zinc-600 font-mono flex-shrink-0">
            #{item.talentId}
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 truncate">
          {item.bonusText || item.tab}
        </div>
      </div>
      {/* Per-preset invested vs cap. Active preset marked with ●. */}
      <div className="flex-shrink-0 flex flex-col gap-0.5 items-end">
        <PresetStat
          label="P1"
          active={activePreset === 0}
          invested={item.investedP1}
          cap={item.cap}
        />
        <PresetStat
          label="P2"
          active={activePreset === 1}
          invested={item.investedP2}
          cap={item.cap}
        />
      </div>
    </div>
  );
}

function PresetStat({
  label,
  active,
  invested,
  cap,
}: {
  label: string;
  active: boolean;
  invested: number;
  cap: number;
}) {
  const gap = Math.max(0, cap - invested);
  const atCap = gap === 0;
  return (
    <div
      className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums whitespace-nowrap"
      title={
        (active ? "Preset ativo in-game · " : "") +
        (atCap ? "no cap" : `faltam ${gap}`)
      }
    >
      <span
        className={`w-7 text-right ${
          active ? "text-sky-300 font-semibold" : "text-zinc-500"
        }`}
      >
        {label}
        {active ? "●" : ""}
      </span>
      <span className="text-zinc-300">
        {invested}
        <span className="text-zinc-600">/{cap}</span>
      </span>
      <span className={`w-14 text-right ${atCap ? "text-emerald-400" : "text-amber-300"}`}>
        {atCap ? "✓ cap" : `faltam ${gap}`}
      </span>
    </div>
  );
}
