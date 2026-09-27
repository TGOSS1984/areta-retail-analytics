import { queryDuckDB } from "@/lib/duckdb";

// Queries behind the Data page: the data quality audit's own tables, as
// generator/quality/build_data_quality.py wrote them. These describe the
// whole warehouse, so the page doesn't take the date or market filters.

export type DqCheck = {
  checkId: string;
  category: string;
  categoryOrder: number;
  tableName: string;
  checkName: string;
  description: string;
  severity: string;
  rowsTested: number;
  rowsFailed: number;
  /** Pass, Warn or Fail; the Cleaning checks are "Fixed" and don't count toward the score. */
  status: "Pass" | "Warn" | "Fail" | "Fixed";
  countsTowardScore: boolean;
  sourceALabel: string | null;
  sourceAValue: number | null;
  sourceBLabel: string | null;
  sourceBValue: number | null;
  runTimestamp: string;
};

export async function fetchDqChecks(): Promise<DqCheck[]> {
  const rows = await queryDuckDB<Omit<DqCheck, "countsTowardScore"> & { countsTowardScore: number }>(`
    SELECT check_id AS "checkId", category, CAST(category_order AS INTEGER) AS "categoryOrder",
           table_name AS "tableName", check_name AS "checkName", check_description AS description, severity,
           CAST(rows_tested AS DOUBLE) AS "rowsTested", CAST(rows_failed AS DOUBLE) AS "rowsFailed", status,
           CAST(counts_toward_score AS INTEGER) AS "countsTowardScore",
           source_a_label AS "sourceALabel", CAST(source_a_value AS DOUBLE) AS "sourceAValue",
           source_b_label AS "sourceBLabel", CAST(source_b_value AS DOUBLE) AS "sourceBValue",
           CAST(run_timestamp AS VARCHAR) AS "runTimestamp"
    FROM dq_check_results
    ORDER BY category_order, check_id
  `);
  return rows.map((r) => ({ ...r, countsTowardScore: Boolean(r.countsTowardScore) }));
}

export type DqTable = {
  tableName: string;
  tableType: string;
  grain: string;
  rowCount: number;
  nullCells: number;
  cellCount: number;
  latestDataDate: string | null;
  daysBehind: number | null;
  allowedLagDays: number | null;
  freshness: string;
};

export async function fetchDqTables(): Promise<DqTable[]> {
  return queryDuckDB<DqTable>(`
    SELECT table_name AS "tableName", table_type AS "tableType", grain,
           CAST(row_count AS DOUBLE) AS "rowCount", CAST(null_cells AS DOUBLE) AS "nullCells",
           CAST(cell_count AS DOUBLE) AS "cellCount", latest_data_date AS "latestDataDate",
           CAST(days_behind_run AS DOUBLE) AS "daysBehind", CAST(allowed_lag_days AS DOUBLE) AS "allowedLagDays",
           freshness_status AS freshness
    FROM dq_table_profile
    ORDER BY CASE table_type WHEN 'Fact' THEN 0 ELSE 1 END, row_count DESC
  `);
}