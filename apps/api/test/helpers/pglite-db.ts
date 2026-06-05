import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { AppDatabase } from "@/infra/db/db.service";
import * as schema from "@/infra/db/schema";

const migrationsFolder = fileURLToPath(new URL("../../src/infra/db/migrations", import.meta.url));

export interface TestDb {
  db: AppDatabase;
  close: () => Promise<void>;
}

/**
 * Spins up an in-memory PGlite (real Postgres in WASM) and applies the project's
 * real Drizzle migrations, so adapter tests run against the actual schema,
 * constraints, FKs, and indexes — without requiring an external Postgres.
 *
 * PgliteDatabase and NodePgDatabase share the query-builder surface our adapters
 * use; the cast to AppDatabase is safe for those operations (research.md DR-012).
 */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return {
    db: db as unknown as AppDatabase,
    close: () => client.close()
  };
}
