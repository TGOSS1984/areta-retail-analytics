"use client";

import { IconShieldCheck, IconCircleCheck, IconDatabase, IconClock, IconFilter } from "@tabler/icons-react";
import { KpiStrip, KpiStripSkeleton, KpiTile } from "@/components/ui/KpiTile";
import type { AsyncState } from "@/lib/hooks/useAsyncData";
import type { DqCheck, DqTable } from "@/lib/queries/dataPage";
import { formatCount, formatShare } from "@/lib/format";
import { formatShortDate } from "@/lib/filters/dates";

export function DataKpis({ checks, tables }: { checks: AsyncState<DqCheck[]>; tables: AsyncState<DqTable[]> }) {
  if (checks.status !== "ready" || tables.status !== "ready") return <KpiStripSkeleton />;
  // Same score as the Power BI page: checks passed over checks that count
  // toward the score (the Cleaning ones report fixes, so they don't).
  const scored = checks.data.filter((c) => c.countsTowardScore);
  const passed = scored.filter((c) => c.status === "Pass").length;
  const warned = scored.filter((c) => c.status === "Warn").length;
  const failed = scored.filter((c) => c.status === "Fail").length;
  const status = failed ? "Fail" : warned ? "Warn" : "Pass";
  const rowsTested = scored.reduce((a, c) => a + c.rowsTested, 0);
  const fixed = checks.data.filter((c) => c.category === "Cleaning").reduce((a, c) => a + c.rowsFailed, 0);
  const latest = tables.data
    .filter((t) => t.tableType === "Fact" && t.latestDataDate)
    .map((t) => t.latestDataDate as string)
    .sort()
    .at(-1);
  const auditTime = checks.data[0]?.runTimestamp;

  return (
    <KpiStrip>
      <KpiTile label="Quality score" value={formatShare(scored.length ? passed / scored.length : 0)} icon={IconShieldCheck}
        delta={`${passed} of ${scored.length} checks`} deltaGood={null} comparison="passed" />
      <KpiTile label="Status" value={status === "Pass" ? "All clear" : status === "Warn" ? "Warnings" : "Failures"} icon={IconCircleCheck}
        delta={`${warned} warn, ${failed} fail`} deltaGood={failed === 0} comparison="" />
      <KpiTile label="Rows tested" value={formatCount(rowsTested, 1)} icon={IconDatabase} delta="across all checks" deltaGood={null} comparison="" />
      <KpiTile label="Latest data" value={latest ? formatShortDate(latest) : "–"} icon={IconClock}
        delta={auditTime ? `audited ${auditTime.slice(0, 16)} UTC` : null} deltaGood={null} comparison="" />
      <KpiTile label="Fixed in cleaning" value={formatCount(fixed)} icon={IconFilter} delta="raw lines corrected" deltaGood={null} comparison="" />
    </KpiStrip>
  );
}