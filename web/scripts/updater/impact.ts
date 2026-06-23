// Cross-references the formula/list diffs against the FORMULA_REGISTRY so each
// change becomes an actionable line: mapped -> "revise <file>", or uncatalogued
// -> the safety-net "investigate" flag. Mirrored constants (registry keys like
// "RandoListo2[8]") connect a changed LIST to the ported file that hardcodes it.
import type { MapDiff } from "./diff";

export function buildImpactReport(
  formulasDiff: MapDiff,
  listsDiff: MapDiff,
  registry: Record<string, string[]>,
): string {
  const items: string[] = [];

  const formulaChanges: [string, string][] = [
    ...formulasDiff.added.map((k): [string, string] => ["adicionada", k]),
    ...formulasDiff.removed.map((k): [string, string] => ["removida", k]),
    ...formulasDiff.changed.map((c): [string, string] => ["alterada", c.key]),
  ];
  for (const [kind, name] of formulaChanges) {
    const files = registry[name];
    if (files) items.push(`- 🔧 \`${name}\` ${kind} → revise: ${files.join(", ")}`);
    else items.push(`- ⚠️ \`${name}\` ${kind} — NÃO catalogado: investigar (port faltando ou fonte nova)`);
  }

  // Mirrored constants: a registry key "List[idx]" ties a changed list to a file.
  for (const c of listsDiff.changed) {
    for (const [name, files] of Object.entries(registry)) {
      const base = name.replace(/\[[0-9]+\]$/, "");
      if (base === c.key && base !== name) {
        items.push(`- 🪞 \`${c.key}\` mudou → constante espelhada (${name}) em: ${files.join(", ")}`);
      }
    }
  }

  const body = items.length
    ? items.join("\n")
    : "_Nenhuma fórmula portada tocada por este update._";
  return ["## Impacto nas fórmulas portadas", "", body].join("\n");
}
