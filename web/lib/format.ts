// Idleon-style number formatting: M / B / T / Q / QQ / QQQ, then scientific.
// Mirrors idleonFormat() from the Apps Script.
export function formatIdleon(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const n = Number(value);
  const abs = Math.abs(n);
  if (abs < 1e6) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  // Past QQQ (1e24) Number's decimal precision breaks toFixed — fall back to exponential.
  if (abs >= 1e24) return n.toExponential(2);
  const units: [number, string][] = [
    [1e6, "M"],
    [1e9, "B"],
    [1e12, "T"],
    [1e15, "Q"],
    [1e18, "QQ"],
    [1e21, "QQQ"],
  ];
  for (let i = units.length - 1; i >= 0; i--) {
    const [div, suffix] = units[i];
    if (abs >= div) return (n / div).toFixed(decimals) + suffix;
  }
  return n.toExponential(2);
}

export function formatPct(numerator: number | null, denominator: number | null): string {
  if (
    numerator === null ||
    denominator === null ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  )
    return "—";
  return ((numerator / denominator) * 100).toFixed(2) + "%";
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}
