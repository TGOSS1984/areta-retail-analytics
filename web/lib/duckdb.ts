"use client";

// Client-only, deliberately — DuckDB-wasm is a browser WASM module, has
// no business running server-side, and Next.js would fail trying to
// import it during SSR if this file didn't guard against that. Every
// caller of this module needs to live inside a Client Component, or
// behind a dynamic import with ssr: false.
//
// One important caveat on everything in this file: I can't run a real
// browser in the environment I built this in, so unlike almost
// everything else in this project, this can't be fully runtime-tested by
// me. What I COULD verify — the SQL these queries run — was checked
// against the actual exported Parquet files using DuckDB's own Python
// bindings, and reproduces the exact figures already validated with
// pandas. The first version of the file-loading approach below (register
// an HTTP URL, let DuckDB range-request it internally) hit a real bug
// when actually run in a browser — "Invalid URL" trying to open the
// registered file NAME rather than the URL — which is exactly the kind
// of thing I can't catch without a browser. Switched to fetching the
// bytes directly and handing DuckDB a buffer instead, a simpler,
// harder-to-get-wrong pattern. Still worth treating this file as the one
// part of the project that needs a real look in devtools before trusting
// it, same as before — just with one real bug already found and fixed
// rather than zero.

import * as duckdb from "@duckdb/duckdb-wasm";

// Every export the app can read. Nothing is fetched up front any more:
// with ten pages that would mean downloading every file before the first
// chart drew. Each query registers only the tables its SQL mentions, the
// first time anything asks for them, and every later query reuses them.
const TABLES = [
  "dim_date",
  "dim_store",
  "dim_style_colour",
  "fact_sales_daily",
  "fact_sales_style_colour_daily",
  "fact_footfall_daily",
  "fact_targets",
  "fact_store_finance",
] as const;

type TableName = (typeof TABLES)[number];

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;
const tablePromises = new Map<TableName, Promise<void>>();

async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);

  if (!bundle.mainWorker) {
    throw new Error("DuckDB-wasm: no worker bundle selected — unsupported browser?");
  }

  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" })
  );

  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  return db;
}

// Fetch the export as raw bytes and hand DuckDB the buffer, rather than
// registering an HTTP URL for it to range-request. The first version did
// the latter and hit "Failed to execute 'open' on 'XMLHttpRequest':
// Invalid URL" in a real browser: DuckDB's HTTP path tried to open the
// registered NAME as a URL. A plain fetch() has nothing DuckDB-specific
// to go wrong, and the files are small enough (16KB-7MB) that range
// requests never bought anything.
async function registerTable(db: duckdb.AsyncDuckDB, table: TableName): Promise<void> {
  const response = await fetch(`/data/${table}.parquet`);
  if (!response.ok) {
    throw new Error(`Failed to fetch /data/${table}.parquet: ${response.status} ${response.statusText}`);
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  await db.registerFileBuffer(`${table}.parquet`, buffer);
  const conn = await db.connect();
  try {
    await conn.query(`CREATE VIEW ${table} AS SELECT * FROM read_parquet('${table}.parquet')`);
  } finally {
    await conn.close();
  }
}

/** The tables a piece of SQL refers to. Word-boundary matched, so
 * fact_sales_daily doesn't also match fact_sales_style_colour_daily. */
function tablesIn(sql: string): TableName[] {
  return TABLES.filter((t) => new RegExp(`\\b${t}\\b`).test(sql));
}

async function ensureTables(db: duckdb.AsyncDuckDB, tables: TableName[]): Promise<void> {
  await Promise.all(
    tables.map((table) => {
      let p = tablePromises.get(table);
      if (!p) {
        p = registerTable(db, table);
        // A failed fetch shouldn't be cached forever; the next query retries.
        p.catch(() => tablePromises.delete(table));
        tablePromises.set(table, p);
      }
      return p;
    }),
  );
}

/** Lazily initialises DuckDB-wasm once, shares the same instance across
 * every caller on the page — instantiating it is not cheap, don't repeat
 * it per component. */
export function getDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = initDuckDB();
  }
  return dbPromise;
}

export async function queryDuckDB<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const db = await getDuckDB();
  await ensureTables(db, tablesIn(sql));
  const conn = await db.connect();
  try {
    const result = await conn.query(sql);
    return result.toArray().map((row) => sanitizeBigInts(row.toJSON()) as T);
  } finally {
    await conn.close();
  }
}

/**
 * DuckDB returns 64-bit integer columns (quantity, business_year, any
 * SUM() over an int64 source column) to JS as native BigInt, not Number
 * — that's correct behaviour on DuckDB's part, done to avoid silently
 * losing precision on values bigger than Number can represent exactly.
 * Nothing in this app needs arbitrary-precision integers though, and
 * mixing a BigInt into ordinary arithmetic (subtracting 1 from a year,
 * dividing to get a percentage) throws rather than silently coercing —
 * hit exactly that in testing. Converting every BigInt in a result row
 * to a plain number here, once, centrally, rather than trying to
 * remember to CAST every integer aggregate in every query — the
 * queries do get explicit CASTs too where it's cheap to add (see
 * salesSummary.ts), but this is the actual safety net.
 */
function sanitizeBigInts<T>(value: T): T {
  if (typeof value === "bigint") {
    return Number(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeBigInts(v)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeBigInts(v)])
    ) as T;
  }
  return value;
}