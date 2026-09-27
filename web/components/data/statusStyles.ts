/** Pill colours for check status and table freshness, matching the Data
 * Quality page in Power BI. */
export const STATUS_PILL: Record<string, string> = {
  Pass: "bg-success/25 text-cloud",
  Fresh: "bg-success/25 text-cloud",
  Warn: "bg-warning/30 text-cloud",
  Stale: "bg-warning/30 text-cloud",
  Fail: "bg-error/35 text-cloud",
  Fixed: "bg-info/25 text-cloud",
  "n/a": "bg-white/10 text-mist",
};