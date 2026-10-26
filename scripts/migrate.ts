import "dotenv/config";
import { runMigrations } from "../src/db/client";

await runMigrations();
console.log("Migrations applied.");
process.exit(0);
