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

const TABLES = ["dim_date", "dim_store", "fact_sales_daily"] as const;

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

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

  // Fetch each export as raw bytes and hand the buffer directly to
  // DuckDB, rather than registering an HTTP URL for it to range-request
  // internally. First version used registerFileURL + HTTP protocol and
  // hit a real bug in testing: "Failed to execute 'open' on
  // 'XMLHttpRequest': Invalid URL" — DuckDB's internal HTTP path was
  // trying to open the registered NAME ("dim_date.parquet") as a URL
  // rather than resolving it to what it was registered against. Fetching
  // the bytes with a plain browser fetch() first sidesteps that code
  // path entirely — nothing DuckDB-specific about a fetch() call, so
  // nothing DuckDB-specific to go wrong. These files are small enough
  // (14KB-6MB) that lazy HTTP range-requests were never buying anything
  // real anyway; the app needs all of it queryable regardless.
  const conn = await db.connect();
  try {
    for (const table of TABLES) {
      const response = await fetch(`/data/${table}.parquet`);
      if (!response.ok) {
        throw new Error(`Failed to fetch /data/${table}.parquet: ${response.status} ${response.statusText}`);
      }
      const buffer = new Uint8Array(await response.arrayBuffer());
      await db.registerFileBuffer(`${table}.parquet`, buffer);
      await conn.query(`CREATE VIEW ${table} AS SELECT * FROM read_parquet('${table}.parquet')`);
    }
  } finally {
    await conn.close();
  }

  return db;
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