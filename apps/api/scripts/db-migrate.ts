import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { loadDbConfig } from "@/config/db.config";

/**
 * Applies pending Drizzle migrations from src/infra/db/migrations.
 * Run explicitly via `pnpm db:migrate` — never on API/worker boot.
 * Env is loaded by the npm script (`--env-file=../../.env`).
 */
async function main(): Promise<void> {
  const { databaseUrl } = loadDbConfig();
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./src/infra/db/migrations" });
  await pool.end();
  process.stdout.write("Migrations applied.\n");
}

main().catch((error) => {
  process.stderr.write(`db:migrate failed: ${String(error)}\n`);
  process.exit(1);
});
