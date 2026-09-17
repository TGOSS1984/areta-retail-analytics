#!/usr/bin/env node
// Copies the generator's Parquet exports into public/data so Next.js can
// serve them as static files the browser can fetch. Runs automatically
// before dev/build (see package.json's predev/prebuild) — shouldn't
// normally need running by hand.

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "..", "data", "exports");
const DEST = join(__dirname, "..", "public", "data");

if (!existsSync(SRC)) {
  console.error(`No exports found at ${SRC} — run "python generator/export_web_data.py" first.`);
  process.exit(1);
}

mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true });
console.log(`Synced Parquet exports: ${SRC} -> ${DEST}`);
