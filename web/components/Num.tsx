import { numParts } from "@/lib/numberFormat";

/** Site-wide number display: sign + 3-decimal digits + a highlighted suffix
 *  span (K/M/B/T/…/E35) + an optional unit. One component so the tree and
 *  tables render the same kind of value the same way everywhere. */
export default function Num({
  value,
  plus = false,
  unit = "",
  className,
  title,
}: {
  value: number;
  /** Show a leading "+" for v >= 0. Negatives always show "-" regardless. */
  plus?: boolean;
  /** Text appended after the suffix, e.g. "x", "%", "pp", "×". */
  unit?: string;
  className?: string;
  /** Defaults to the full value (String(value)) when omitted. */
  title?: string;
}) {
  const resolvedTitle = title ?? String(value);
  const parts = numParts(value);
  if (!parts) {
    return (
      <span className={className} title={resolvedTitle}>
        —
      </span>
    );
  }
  const sign = parts.sign || (plus ? "+" : "");
  return (
    <span className={className} title={resolvedTitle}>
      {sign}
      {parts.num}
      <span className="text-[1.15em] font-semibold">{parts.suffix}</span>
      {unit}
    </span>
  );
}
