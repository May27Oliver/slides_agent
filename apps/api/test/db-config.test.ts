import { describe, expect, it } from "vitest";
import { loadDbConfig } from "@/config/db.config";

const URL = "postgresql://localhost:5432/slides_agent";

describe("loadDbConfig", () => {
  it("fails fast when DATABASE_URL is missing", () => {
    expect(() => loadDbConfig({})).toThrow(/DATABASE_URL/u);
  });

  it("rejects a blank DATABASE_URL", () => {
    expect(() => loadDbConfig({ DATABASE_URL: "   " })).toThrow(/DATABASE_URL/u);
  });

  it("returns the url with conservative pool defaults (api role)", () => {
    expect(loadDbConfig({ DATABASE_URL: URL })).toEqual({
      databaseUrl: URL,
      poolMax: 5,
      idleTimeoutMs: 30_000,
      connectionTimeoutMs: 5_000,
      maxLifetimeSeconds: 300
    });
  });

  it("uses the smaller worker pool default when the role is worker", () => {
    expect(loadDbConfig({ DATABASE_URL: URL, DB_POOL_ROLE: "worker" }).poolMax).toBe(2);
  });

  it("prefers DB_WORKER_POOL_MAX for the worker and DB_POOL_MAX for the api", () => {
    expect(
      loadDbConfig({ DATABASE_URL: URL, DB_POOL_ROLE: "worker", DB_WORKER_POOL_MAX: "3" }).poolMax
    ).toBe(3);
    // DB_POOL_MAX must not bleed into the worker's max.
    expect(
      loadDbConfig({ DATABASE_URL: URL, DB_POOL_ROLE: "worker", DB_POOL_MAX: "20" }).poolMax
    ).toBe(2);
    expect(loadDbConfig({ DATABASE_URL: URL, DB_POOL_MAX: "10" }).poolMax).toBe(10);
  });

  it("parses the timeout/lifetime knobs when set", () => {
    expect(
      loadDbConfig({
        DATABASE_URL: URL,
        DB_POOL_IDLE_TIMEOUT_MS: "1000",
        DB_POOL_CONNECTION_TIMEOUT_MS: "2000",
        DB_POOL_MAX_LIFETIME_SECONDS: "60"
      })
    ).toMatchObject({ idleTimeoutMs: 1000, connectionTimeoutMs: 2000, maxLifetimeSeconds: 60 });
  });

  it("fails fast on a present-but-invalid pool knob", () => {
    expect(() => loadDbConfig({ DATABASE_URL: URL, DB_POOL_MAX: "0" })).toThrow(/DB_POOL_MAX/u);
    expect(() => loadDbConfig({ DATABASE_URL: URL, DB_POOL_MAX: "-1" })).toThrow(/DB_POOL_MAX/u);
    expect(() => loadDbConfig({ DATABASE_URL: URL, DB_POOL_MAX: "abc" })).toThrow(/DB_POOL_MAX/u);
    expect(() => loadDbConfig({ DATABASE_URL: URL, DB_POOL_MAX: "1.5" })).toThrow(/DB_POOL_MAX/u);
    expect(() =>
      loadDbConfig({ DATABASE_URL: URL, DB_POOL_CONNECTION_TIMEOUT_MS: "nope" })
    ).toThrow(/DB_POOL_CONNECTION_TIMEOUT_MS/u);
  });
});
