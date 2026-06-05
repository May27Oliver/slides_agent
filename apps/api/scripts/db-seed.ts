import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadSeedAccounts } from "@/config/auth.config";
import { loadDbConfig } from "@/config/db.config";
import type { AppDatabase } from "@/infra/db/db.service";
import { seedAccounts } from "@/infra/db/seed-accounts";
import * as schema from "@/infra/db/schema";

/**
 * Seeds the DB account allowlist from AUTH_ACCOUNTS (deprecated env source).
 * Idempotent: re-running upserts by id. Env loaded by the npm script
 * (`--env-file=../../.env`). See research.md DR-003.
 */
async function main(): Promise<void> {
  const { databaseUrl } = loadDbConfig();
  const source = loadSeedAccounts();
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema }) as AppDatabase;
  const count = await seedAccounts(db, source);
  await pool.end();
  process.stdout.write(`Seeded ${count} account(s).\n`);
}

main().catch((error) => {
  process.stderr.write(`db:seed failed: ${String(error)}\n`);
  process.exit(1);
});
