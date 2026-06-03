/**
 * Shared Redis infrastructure config. `REDIS_URL` is required — the API and the
 * worker fail fast on startup when it is absent. This is backend-owned and must
 * never be exposed as a public request/response field.
 */
export interface RedisConfig {
  redisUrl: string;
}

type EnvLike = Record<string, string | undefined>;

export function loadRedisConfig(env: EnvLike = process.env): RedisConfig {
  const redisUrl = env.REDIS_URL?.trim();
  if (!redisUrl) {
    // Safe message: names the missing knob without leaking any connection detail.
    throw new Error("REDIS_URL is required but is not configured.");
  }

  return { redisUrl };
}
