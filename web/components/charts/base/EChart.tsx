"use client";

import ReactECharts from "echarts-for-react";
import { useElementSize } from "@/lib/hooks/useElementSize";
import { baseOption } from "@/lib/chartTheme";

type EChartProps = {
  /** Builds the option for the current width, so a chart can move its
   * legend, drop labels or change orientation when it's narrow, rather
   * than only getting smaller. */
  build: (width: number) => Record<string, unknown>;
  /** For charts that can't sensibly shrink past a width (a year of
   * calendar cells): below it the chart scrolls sideways instead. */
  minWidth?: number;
  onEvents?: Record<string, (params: unknown) => void>;
};

export function EChart({ build, minWidth, onEvents }: EChartProps) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const drawWidth = minWidth ? Math.max(width, minWidth) : width;

  return (
    <div ref={ref} className={`h-full w-full ${minWidth ? "overflow-x-auto overflow-y-hidden" : ""}`}>
      {width > 0 && (
        <div style={{ height: "100%", width: minWidth ? drawWidth : "100%" }}>
          <ReactECharts
            option={{ ...baseOption, ...build(drawWidth) }}
            style={{ height: "100%", width: "100%" }}
            notMerge
            onEvents={onEvents}
          />
        </div>
      )}
    </div>
  );
}