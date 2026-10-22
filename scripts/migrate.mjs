// Tiny migration runner for Appwrite TablesDB (PostgreSQL-backed).
// Applies db/migrations/*.mjs in order; applied names are stored in the `migrations` table.
import { Client, Storage, TablesDB, ID } from "node-appwrite";
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Ledger: la tabla `migrations` guarda el nombre de cada migración ya aplicada. Cada archivo de
// db/migrations exporta `up(ctx)`. OJO: se compara por NOMBRE de archivo; si el ledger remoto
// usa otros nombres (como producción hoy) intentará reaplicar todo. Ver docs/production-appwrite.md.
const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, APPWRITE_DATABASE_ID = "agentsolver", APPWRITE_STORAGE_BUCKET_ID = "documents" } = process.env;
if (!APPWRITE_API_KEY) throw new Error("Missing APPWRITE_* env (run `bun run appwrite:bootstrap`, then use bun --env-file=.env.local).");

const client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID).setKey(APPWRITE_API_KEY);
const db = new TablesDB(client);
const storage = new Storage(client);
const DB = APPWRITE_DATABASE_ID;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = async (fn) => { try { await fn(); return true; } catch (e) { if (e.code === 404) return false; throw e; } };

// Columns are created asynchronously by Appwrite; wait until all are available.
async function waitColumns(table) {
  for (let i = 0; i < 60; i++) {
    const { columns } = await db.listColumns(DB, table);
    if (columns.every((c) => c.status === "available")) return;
    if (columns.some((c) => c.status === "failed")) throw new Error(`column failed in ${table}`);
    await sleep(500);
  }
  throw new Error(`timeout waiting for columns of ${table}`);
}

const ctx = {
  db, storage, DB, BUCKET_ID: APPWRITE_STORAGE_BUCKET_ID, ID, waitColumns,
  async ensureTable(id, name) {
    if (!(await exists(() => db.getTable(DB, id)))) await db.createTable(DB, id, name, []);
  },
};

if (!(await exists(() => db.get(DB)))) await db.create(DB, "wow");
await ctx.ensureTable("migrations", "migrations");
if (!(await db.listColumns(DB, "migrations")).columns.length) {
  await db.createStringColumn(DB, "migrations", "name", 255, true);
  await waitColumns("migrations");
}

const applied = new Set((await db.listRows(DB, "migrations")).rows.map((r) => r.$id));
const dir = resolve("db/migrations");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".mjs")).sort()) {
  const name = file.replace(/\.mjs$/, "");
  if (applied.has(name)) { console.log(`skip   ${name}`); continue; }
  console.log(`apply  ${name}`);
  const { up } = await import(pathToFileURL(resolve(dir, file)).href);
  await up(ctx);
  await db.createRow(DB, "migrations", name, { name });
}
console.log("done");
