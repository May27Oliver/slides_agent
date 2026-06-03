import { describe, expect, it } from "vitest";
import { loadRedisConfig } from "@/infra/redis/redis.config";

describe("redis config", () => {
  it("reads REDIS_URL", () => {
    expect(loadRedisConfig({ REDIS_URL: "redis://127.0.0.1:6379" })).toEqual({
      redisUrl: "redis://127.0.0.1:6379"
    });
  });

  it("fails fast when REDIS_URL is missing", () => {
    expect(() => loadRedisConfig({})).toThrow(/REDIS_URL/u);
  });

  it("does not leak any value beyond redisUrl", () => {
    const config = loadRedisConfig({ REDIS_URL: " redis://cache:6379 " });
    expect(config).toEqual({ redisUrl: "redis://cache:6379" });
  });
});
