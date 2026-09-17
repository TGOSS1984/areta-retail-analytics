"use client";

// Client-only, deliberately — DuckDB-wasm is a browser WASM module, has
// no business running server-side, and Next.js would fail trying to
// import it during SSR if this file didn't guard against that. Every
// caller of this module needs to live inside a Client Component, or
// behind a dynamic import with ssr: false.
//
// One important caveat on everything in this file: I can't run a real
// browser in the environment I built this in, so unlike almost
// everything else in this project, this hasn't been runtime-tested end
// to end. What I COULD verify — the SQL these queries run — was checked
// against the actual exported Parquet files using DuckDB's own Python
// bindings first, and reproduces the exact figures already validated
// with pandas. The WASM/Worker loading and file-registration mechanics
// below follow DuckDB-wasm's own documented jsDelivr-bundle pattern,
// which is the standard approach, not something improvised — but "the
// standard approach" is the best I can offer here, not the same as
// having watched it run. First thing worth doing once this is pulled
// down locally: open the browser console and confirm it actually
// connects before trusting anything it returns.

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

  // register the exports as named files, then wrap each in a view so
  // application queries can reference plain table names rather than
  // read_parquet(...) everywhere
  const conn = await db.connect();
  try {
    for (const table of TABLES) {
      await db.registerFileURL(
        `${table}.parquet`,
        `/data/${table}.parquet`,
        duckdb.DuckDBDataProtocol.HTTP,
        false
      );
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
    return result.toArray().map((row) => row.toJSON() as T);
  } finally {
    await conn.close();
  }
}