/**
 * Shared database config (feature 006). `DATABASE_URL` is required — the API and
 * the worker fail fast on startup when it is absent. Backend-owned; never exposed
 * as a public request/response field. Mirrors loadRedisConfig.
 *
 * Connection-pool sizing is conservative by default and fully tunable via env.
 * The pool max is role-aware: the API process serves interactive traffic (login,
 * deck reads, job creation) while the worker only touches the DB to auto-save a
 * deck after a successful generation — so the worker defaults to a smaller pool.
 * Total DB connections ≈ (API replicas + worker replicas) × that role's max;
 * keep it well under Postgres `max_connections`.
 */
export interface DbConfig {
  databaseUrl: string;
  /** Max connections this process's pool will open (role-aware default). */
  poolMax: number;
  /** Idle connections are released after this many ms. */
  idleTimeoutMs: number;
  /** Fail a connection attempt after this many ms instead of hanging a request. */
  connectionTimeoutMs: number;
  /** Recycle a connection after this many seconds (avoids stale proxy/DB sockets). */
  maxLifetimeSeconds: number;
}

/** Which process owns the pool — drives only the default pool max. */
export type DbPoolRole = "api" | "worker";

type EnvLike = Record<string, string | undefined>;

const DEFAULT_API_POOL_MAX = 5;
const DEFAULT_WORKER_POOL_MAX = 2;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_LIFETIME_SECONDS = 300;

export function loadDbConfig(env: EnvLike = process.env): DbConfig {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    // Safe message: names the missing knob without leaking any connection detail.
    throw new Error("DATABASE_URL is required but is not configured.");
  }

  const role: DbPoolRole = env.DB_POOL_ROLE === "worker" ? "worker" : "api";
  const poolMax =
    role === "worker"
      ? positiveInt(env.DB_WORKER_POOL_MAX, DEFAULT_WORKER_POOL_MAX, "DB_WORKER_POOL_MAX")
      : positiveInt(env.DB_POOL_MAX, DEFAULT_API_POOL_MAX, "DB_POOL_MAX");

  return {
    databaseUrl,
    poolMax,
    idleTimeoutMs: positiveInt(
      env.DB_POOL_IDLE_TIMEOUT_MS,
      DEFAULT_IDLE_TIMEOUT_MS,
      "DB_POOL_IDLE_TIMEOUT_MS"
    ),
    connectionTimeoutMs: positiveInt(
      env.DB_POOL_CONNECTION_TIMEOUT_MS,
      DEFAULT_CONNECTION_TIMEOUT_MS,
      "DB_POOL_CONNECTION_TIMEOUT_MS"
    ),
    maxLifetimeSeconds: positiveInt(
      env.DB_POOL_MAX_LIFETIME_SECONDS,
      DEFAULT_MAX_LIFETIME_SECONDS,
      "DB_POOL_MAX_LIFETIME_SECONDS"
    )
  };
}

/**
 * Parse a positive-integer env knob. Unset/blank falls back to the default; a
 * present-but-invalid value fails fast (a typo'd pool size should not silently
 * become a default and mask the misconfiguration).
 */
function positiveInt(raw: string | undefined, fallback: number, name: string): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return fallback;
  }

  const value = Number(trimmed);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer when set.`);
  }
  return value;
}
