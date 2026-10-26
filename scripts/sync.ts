import "dotenv/config";
import { getDb, runMigrations } from "../src/db/client";
import { runSync } from "../src/lib/sync";

await runMigrations();
const reports = await runSync(getDb());
console.table(reports.map((r) => ({ ...r, errors: r.errors.join("; ") })));
process.exit(reports.some((r) => r.errors.length) ? 1 : 0);
