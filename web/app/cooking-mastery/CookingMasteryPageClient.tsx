"use client";

import { useMemo, useState } from "react";
import ProfileNameLoader from "@/components/ProfileNameLoader";
import MasteryOptimizer from "@/components/cookingMastery/MasteryOptimizer";

/** Parses an Exp/h like "56.6m", "56,6M/h" or "56600000" into a number. */
function parseExpRate(s: string): number | undefined {
  const t = s.trim().toLowerCase().replace(/,/g, ".");
  const m = t.match(/([\d.]+)\s*([kmbt])?/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n <= 0) return undefined;
  const mult =
    ({ k: 1e3, m: 1e6, b: 1e9, t: 1e12 } as Record<string, number>)[m[2] ?? ""] ?? 1;
  return n * mult;
}

export default function CookingMasteryPageClient() {
  const [envelope, setEnvelope] = useState<unknown>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [expRateStr, setExpRateStr] = useState("");

  const ingameExpRate = useMemo(() => parseExpRate(expRateStr), [expRateStr]);

  function applyPaste() {
    try {
      const parsed = JSON.parse(pasteText);
      setEnvelope(parsed);
      setPasteError(null);
    } catch {
      setPasteError(
        "JSON inválido. Cole o export do IdleonToolbox (Copy Data for Support) ou o save bruto.",
      );
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-3 pb-12">
      <header className="py-4">
        <h1 className="text-2xl font-bold text-gold">🍳 Cooking Mastery Optimizer</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Distribua seus <strong>Purple PTS</strong> para maximizar a Exp/h do
          Cooking Mastery (desbloqueado no Rift 61). Tudo é calculado localmente
          no seu navegador.
        </p>
      </header>

      <ProfileNameLoader
        storageKey="cooking-mastery.playerName"
        onSave={(save) => {
          setEnvelope(save);
          setPasteError(null);
        }}
        onError={(msg) => setPasteError(msg)}
      >
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200 select-none">
            …ou colar JSON manualmente
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Cole aqui o JSON do save (Copy Data for Support no IdleonToolbox)"
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-xs font-mono"
            />
            <button
              type="button"
              onClick={applyPaste}
              disabled={!pasteText.trim()}
              className="self-start bg-gold text-ink font-bold rounded px-4 py-2 text-sm disabled:opacity-50"
            >
              Calcular
            </button>
          </div>
        </details>
      </ProfileNameLoader>

      {/* In-game Exp/h calibration */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 mb-4">
        <label className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gold">⚡ Exp/h in-game</span>
          <input
            type="text"
            inputMode="decimal"
            value={expRateStr}
            onChange={(e) => setExpRateStr(e.target.value)}
            placeholder="ex: 56.6m"
            className="bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm w-40 font-mono"
          />
          <span className="text-xs text-zinc-500">(opcional)</span>
        </label>
        <p className="text-xs text-zinc-500 mt-2">
          A Exp/h é <strong>calculada automaticamente</strong> do seu save (vial,
          Arcade, Salt Lick, Research Grid, Zuperbit e Companion incluídos).
          Informe a Exp/h que o jogo mostra apenas se quiser calibração fina — o
          ganho percentual da otimização já é exato de qualquer forma.
        </p>
      </div>

      {pasteError && (
        <p className="text-xs text-red-400 mb-3">⚠ {pasteError}</p>
      )}

      <MasteryOptimizer envelope={envelope} ingameExpRate={ingameExpRate} />

      <footer className="mt-8 text-[11px] text-zinc-600 text-center border-t border-zinc-900 pt-3">
        Exp/h porta a fórmula <code>ExpRateCook</code> do jogo (Rift 61). A
        alocação ótima usa greedy water-filling — exato para o produto
        multiplicativo dos upgrades.
      </footer>
    </main>
  );
}
