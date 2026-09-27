import { queryDuckDB } from "@/lib/duckdb";
import type { ResolvedFilters } from "@/lib/filters/filters";
import { addDays } from "@/lib/filters/dates";
import { marketAnd } from "@/lib/filters/sql";

// The Forecasting page's projection. Deliberately simple, and stated on
// the page, so anyone can check it:
//
//   1. Growth so far: this year's sales to date over the same days last
//      year (like-for-like, 364 days back).
//   2. Every day still to come is last year's same day, times that growth.
//      Last year's shape carries the seasonality, Black Friday and all.
//   3. The range: the same projection using the 10th and 90th percentile
//      of this year's week-by-week growth instead of the average, so the
//      band is as wide as this year's own ups and downs have been.
//
// It always looks at the whole business year, whatever period range is
// picked, and follows the market filter. A year that's finished is just
// its actuals; the first year of data has no last year to project from.

export type ForecastWeek = {
  week: number;
  cumActual: number | null;
  cumForecast: number | null;
  cumLow: number | null;
  cumHigh: number | null;
  cumTarget: number;
};

export type ForecastPeriod = {
  period: number;
  label: string;
  ly: number;
  target: number;
  actual: number;
  /** Actual to date plus the projection for the rest of the period. */
  projected: number;
  status: "complete" | "trading" | "future";
};

export type Forecast =
  | { available: false; reason: string }
  | {
      available: true;
      year: number;
      complete: boolean;
      growth: number;
      growthLow: number;
      growthHigh: number;
      actualToDate: number;
      targetToDate: number;
      projected: number;
      projectedLow: number;
      projectedHigh: number;
      targetFull: number;
      lyFull: number;
      weeksRemaining: number;
      /** What the rest of the year has to average per week to hit target. */
      neededPerWeek: number;
      /** What the projection has it averaging per week. */
      projectedPerWeek: number;
      weeks: ForecastWeek[];
      periods: ForecastPeriod[];
    };

function percentile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export async function fetchForecast(f: ResolvedFilters): Promise<Forecast> {
  if (!f.hasLastYear) {
    return { available: false, reason: "The first year of data has no last year to project from." };
  }

  const days = await queryDuckDB<{ date: string; week: number; period: number; label: string }>(`
    SELECT CAST(full_date AS VARCHAR) AS date, CAST(business_week_number AS INTEGER) AS week,
           CAST(business_period_number AS INTEGER) AS period, business_period_label AS label
    FROM dim_date WHERE business_year = ${f.year} ORDER BY full_date
  `);
  const yearStart = days[0].date;
  const yearEnd = days[days.length - 1].date;
  const lastActual = f.lastDataDate < yearEnd ? f.lastDataDate : yearEnd;

  const sales = await queryDuckDB<{ date: string; sales: number }>(`
    SELECT CAST(x.date AS VARCHAR) AS date, CAST(SUM(x.net_sales_gbp) AS DOUBLE) AS sales
    FROM fact_sales_daily x
    JOIN dim_store s ON s.store_id = x.store_id
    WHERE x.date BETWEEN DATE '${addDays(yearStart, -364)}' AND DATE '${lastActual}' ${marketAnd(f, "s")}
    GROUP BY 1
  `);
  const targets = await queryDuckDB<{ period: number; target: number }>(`
    SELECT CAST(t.business_period_number AS INTEGER) AS period, CAST(SUM(t.target_net_sales_gbp) AS DOUBLE) AS target
    FROM fact_targets t
    JOIN dim_store s ON s.store_id = t.store_id
    WHERE t.business_year = ${f.year} ${marketAnd(f, "s")}
    GROUP BY 1
  `);

  const salesByDate = new Map(sales.map((r) => [r.date, r.sales]));
  const targetByPeriod = new Map(targets.map((r) => [r.period, r.target]));

  // Each day's last-year sales, and its share of its period's last-year
  // total, which is how the period targets are spread across the days.
  const ly = days.map((d) => salesByDate.get(addDays(d.date, -364)) ?? 0);
  const lyPeriodTotal = new Map<number, number>();
  days.forEach((d, i) => lyPeriodTotal.set(d.period, (lyPeriodTotal.get(d.period) ?? 0) + ly[i]));
  const daysInPeriod = new Map<number, number>();
  days.forEach((d) => daysInPeriod.set(d.period, (daysInPeriod.get(d.period) ?? 0) + 1));
  const dayTarget = days.map((d, i) => {
    const total = lyPeriodTotal.get(d.period) ?? 0;
    const share = total ? ly[i] / total : 1 / (daysInPeriod.get(d.period) ?? 1);
    return (targetByPeriod.get(d.period) ?? 0) * share;
  });

  const isActual = days.map((d) => d.date <= lastActual);
  const actual = days.map((d, i) => (isActual[i] ? salesByDate.get(d.date) ?? 0 : 0));

  // 1. Growth so far, like-for-like.
  const tyToDate = actual.reduce((a, v) => a + v, 0);
  const lyToDate = ly.reduce((a, v, i) => a + (isActual[i] ? v : 0), 0);
  const growth = lyToDate ? tyToDate / lyToDate : 1;

  // 3. The spread of week-by-week growth, from fully traded weeks only.
  const weekTy = new Map<number, number>();
  const weekLy = new Map<number, number>();
  const weekDays = new Map<number, number>();
  days.forEach((d, i) => {
    if (!isActual[i]) return;
    weekTy.set(d.week, (weekTy.get(d.week) ?? 0) + actual[i]);
    weekLy.set(d.week, (weekLy.get(d.week) ?? 0) + ly[i]);
    weekDays.set(d.week, (weekDays.get(d.week) ?? 0) + 1);
  });
  const weeklyGrowth = Array.from(weekDays.entries())
    .filter(([w, n]) => n === 7 && (weekLy.get(w) ?? 0) > 0)
    .map(([w]) => (weekTy.get(w) ?? 0) / (weekLy.get(w) as number))
    .sort((a, b) => a - b);
  // With too few weeks for a spread to mean anything, fall back to +/-3%.
  const growthLow = weeklyGrowth.length >= 4 ? Math.min(growth, percentile(weeklyGrowth, 0.1)) : growth - 0.03;
  const growthHigh = weeklyGrowth.length >= 4 ? Math.max(growth, percentile(weeklyGrowth, 0.9)) : growth + 0.03;

  // 2. The projection, day by day.
  const fc = days.map((_, i) => (isActual[i] ? actual[i] : ly[i] * growth));
  const lowDay = days.map((_, i) => (isActual[i] ? actual[i] : ly[i] * growthLow));
  const highDay = days.map((_, i) => (isActual[i] ? actual[i] : ly[i] * growthHigh));

  // Cumulative by week, for the chart. Actuals stop at the last traded
  // week; the projection and its band start from there, so the lines join.
  const weeksList = Array.from(new Set(days.map((d) => d.week))).sort((a, b) => a - b);
  const lastActualWeek = days[isActual.lastIndexOf(true)]?.week ?? 0;
  let cA = 0, cF = 0, cL = 0, cH = 0, cT = 0;
  const weeks: ForecastWeek[] = weeksList.map((w) => {
    days.forEach((d, i) => {
      if (d.week !== w) return;
      cA += actual[i];
      cF += fc[i];
      cL += lowDay[i];
      cH += highDay[i];
      cT += dayTarget[i];
    });
    const projecting = w >= lastActualWeek;
    return {
      week: w,
      cumActual: w <= lastActualWeek ? cA : null,
      cumForecast: projecting ? cF : null,
      cumLow: projecting ? cL : null,
      cumHigh: projecting ? cH : null,
      cumTarget: cT,
    };
  });

  const periodsList = Array.from(new Set(days.map((d) => d.period))).sort((a, b) => a - b);
  const periods: ForecastPeriod[] = periodsList.map((p) => {
    const idx = days.map((d, i) => (d.period === p ? i : -1)).filter((i) => i >= 0);
    const traded = idx.filter((i) => isActual[i]).length;
    return {
      period: p,
      label: days[idx[0]].label,
      ly: idx.reduce((a, i) => a + ly[i], 0),
      target: targetByPeriod.get(p) ?? 0,
      actual: idx.reduce((a, i) => a + actual[i], 0),
      projected: idx.reduce((a, i) => a + fc[i], 0),
      status: traded === idx.length ? "complete" : traded > 0 ? "trading" : "future",
    };
  });

  const sum = (arr: number[]) => arr.reduce((a, v) => a + v, 0);
  const targetFull = sum(dayTarget);
  const targetToDate = sum(dayTarget.filter((_, i) => isActual[i]));
  const remainingDays = isActual.filter((a) => !a).length;
  const weeksRemaining = remainingDays / 7;
  const projected = sum(fc);

  return {
    available: true,
    year: f.year,
    complete: remainingDays === 0,
    growth,
    growthLow,
    growthHigh,
    actualToDate: tyToDate,
    targetToDate,
    projected,
    projectedLow: sum(lowDay),
    projectedHigh: sum(highDay),
    targetFull,
    lyFull: sum(ly),
    weeksRemaining,
    neededPerWeek: weeksRemaining ? (targetFull - tyToDate) / weeksRemaining : 0,
    projectedPerWeek: weeksRemaining ? (projected - tyToDate) / weeksRemaining : 0,
    weeks,
    periods,
  };
}