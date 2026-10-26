import fs from "node:fs";
import path from "node:path";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

const MIGRATIONS = path.join(process.cwd(), "drizzle");

function create() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const sql = postgres(url, { max: 5, prepare: false });
    const db = drizzlePostgres(sql, { schema });
    return { db, migrate: () => migratePostgres(db, { migrationsFolder: MIGRATIONS }) };
  }
  // No DATABASE_URL: embedded Postgres on disk, good enough for local development.
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const db = drizzlePglite(dataDir, { schema });
  return { db, migrate: () => migratePglite(db, { migrationsFolder: MIGRATIONS }) };
}

type Handle = ReturnType<typeof create>;
const globalForDb = globalThis as unknown as { __db?: Handle };

function handle(): Handle {
  globalForDb.__db ??= create();
  return globalForDb.__db;
}

// Both drivers expose the same query builder; type against one of them.
export type Db = ReturnType<typeof drizzlePostgres<typeof schema>>;

export function getDb(): Db {
  return handle().db as unknown as Db;
}

export async function runMigrations() {
  await handle().migrate();
}
