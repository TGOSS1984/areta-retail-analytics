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