import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadDbConfig } from "@/config/db.config";
import * as schema from "@/infra/db/schema";

export type AppDatabase = NodePgDatabase<typeof schema>;

/**
 * Owns the process-wide shared PostgreSQL connection pool and the typed Drizzle
 * handle. Features inject the handle via {@link DRIZZLE} (or {@link DbService});
 * they do not own it. The pool is created lazily (pg connects on first query),
 * so constructing this service does not require a reachable database — only a
 * configured DATABASE_URL. Mirrors RedisService.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool: Pool;
  readonly db: AppDatabase;

  constructor() {
    const config = loadDbConfig();
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      // Conservative, tunable, fail-fast pooling (see loadDbConfig). Role-aware
      // max keeps total connections low across API + worker processes.
      max: config.poolMax,
      idleTimeoutMillis: config.idleTimeoutMs,
      connectionTimeoutMillis: config.connectionTimeoutMs,
      maxLifetimeSeconds: config.maxLifetimeSeconds
    });
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end().catch(() => undefined);
  }
}
