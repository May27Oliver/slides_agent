/**
 * Shared database config (feature 006). `DATABASE_URL` is required — the API and
 * the worker fail fast on startup when it is absent. Backend-owned; never exposed
 * as a public request/response field. Mirrors loadRedisConfig.
 */
export interface DbConfig {
  databaseUrl: string;
}

type EnvLike = Record<string, string | undefined>;

export function loadDbConfig(env: EnvLike = process.env): DbConfig {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    // Safe message: names the missing knob without leaking any connection detail.
    throw new Error("DATABASE_URL is required but is not configured.");
  }

  return { databaseUrl };
}
