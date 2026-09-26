// One place for the chart look, so every page's ECharts match the
// Overview ones and the Power BI theme: Montserrat, mist axis text, faint
// grid lines, deep-terrain slice borders.

export const COLORS = {
  gold: "#D0AA62",
  teal: "#1F7486",
  deepTerrain: "#003744",
  slate: "#4A5B63",
  mist: "#8D9AA1",
  cloud: "#F7F6F3",
  stone: "#E8E1D6",
  success: "#2E7D32",
  successBright: "#4CAF50",
  error: "#D32F2F",
  errorBright: "#EF5350",
} as const;

/** Sequential scale for heatmaps: card background to gold via teal. */
export const HEAT_SCALE = ["#0B3B45", "#1F7486", "#6FA5A8", "#D0AA62"];

export const PALETTE = [COLORS.gold, COLORS.teal, COLORS.mist, COLORS.slate, "#6FA5A8", "#B98A3E"];

export const axisLabel = { color: COLORS.mist, fontSize: 11 };
export const axisLine = { lineStyle: { color: "rgba(255,255,255,0.15)" } };
export const splitLine = { lineStyle: { color: "rgba(255,255,255,0.08)" } };

export const tooltipBase = {
  backgroundColor: "rgba(0, 20, 26, 0.95)",
  borderColor: "rgba(255,255,255,0.12)",
  textStyle: { color: COLORS.cloud, fontSize: 12 },
  // Keeps tooltips inside the chart box on small screens instead of
  // spilling off the edge of the viewport.
  confine: true,
};

export const baseOption = {
  textStyle: { fontFamily: "Montserrat, sans-serif" },
  animationDuration: 500,
};

/** Under this width a chart switches to its compact form. */
export const COMPACT_WIDTH = 520;

/** Diverging scale for growth and variance: red below zero, the card
 * colour at zero, green above. */
export const DIVERGING = ["#EF5350", "#0B3B45", "#4CAF50"];