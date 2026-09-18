type SparklineProps = {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
};

/**
 * Plain SVG polyline, not an ECharts instance — pulling in a full chart
 * library per KPI card (six of them on Hero.tsx) for a shape this small
 * would be a lot of weight for very little: no axes, no tooltip, no
 * interactivity, just a trend shape.
 */
export function Sparkline({ data, color = "#D0AA62", width = 64, height = 24 }: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // flat data (all-equal) would otherwise divide by zero

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}