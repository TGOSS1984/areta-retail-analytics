export function formatGbpMillions(value: number): string {
  return `£${(value / 1_000_000).toFixed(2)}M`;
}

export function formatThousands(value: number): string {
  return `${(value / 1_000).toFixed(1)}K`;
}

export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatDelta(value: number, unit: "%" | "pp" = "%"): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${unit}`;
}

/** £ with a unit that suits the size: £21.2M, £350K, £76. */
export function formatGbpShort(value: number, digits = 1): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `${sign}£${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : digits)}K`;
  return `${sign}£${abs.toFixed(0)}`;
}

/** Counts with a unit that suits the size: 1.31M, 228K, 950. */
export function formatCount(value: number, digits = 1): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

/** A 0-1 fraction as a percentage: 0.175 -> "17.5%". */
export function formatShare(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Percentage change, or null when there's nothing to compare with. */
export function pctChange(current: number, prior: number | null): number | null {
  if (prior === null || prior === 0) return null;
  return (current / prior - 1) * 100;
}

/** Change between two 0-1 fractions in percentage points. */
export function ppChange(current: number, prior: number | null): number | null {
  if (prior === null) return null;
  return (current - prior) * 100;
}