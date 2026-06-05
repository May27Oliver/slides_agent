import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DbService } from "@/infra/db/db.service";

// DbService reads process.env (via loadDbConfig) in its constructor, so we set
// the knobs around each construction and restore afterwards. The pool connects
// lazily, so no real database is touched.
const SNAPSHOT_KEYS = [
  "DATABASE_URL",
  "DB_POOL_ROLE",
  "DB_POOL_MAX",
  "DB_WORKER_POOL_MAX",
  "DB_POOL_IDLE_TIMEOUT_MS",
  "DB_POOL_CONNECTION_TIMEOUT_MS",
  "DB_POOL_MAX_LIFETIME_SECONDS"
] as const;

describe("DbService pool configuration", () => {
  let saved: Record<string, string | undefined>;
  let service: DbService | undefined;

  beforeEach(() => {
    saved = Object.fromEntries(SNAPSHOT_KEYS.map((k) => [k, process.env[k]]));
    for (const key of SNAPSHOT_KEYS) {
      delete process.env[key];
    }
    process.env.DATABASE_URL = "postgresql://localhost:5432/slides_agent";
  });

  afterEach(async () => {
    await service?.onModuleDestroy();
    service = undefined;
    for (const key of SNAPSHOT_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it("applies the resolved pool settings to the pg Pool", () => {
    process.env.DB_POOL_MAX = "7";
    process.env.DB_POOL_IDLE_TIMEOUT_MS = "11000";
    process.env.DB_POOL_CONNECTION_TIMEOUT_MS = "2200";
    process.env.DB_POOL_MAX_LIFETIME_SECONDS = "120";

    service = new DbService();
    const options = service.pool.options as Record<string, unknown>;

    expect(options.max).toBe(7);
    expect(options.idleTimeoutMillis).toBe(11_000);
    expect(options.connectionTimeoutMillis).toBe(2_200);
    expect(options.maxLifetimeSeconds).toBe(120);
  });

  it("uses the smaller worker pool default in the worker role", () => {
    process.env.DB_POOL_ROLE = "worker";

    service = new DbService();
    expect((service.pool.options as Record<string, unknown>).max).toBe(2);
  });
});
