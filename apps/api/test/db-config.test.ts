import { describe, expect, it } from "vitest";
import { loadDbConfig } from "@/config/db.config";

describe("loadDbConfig", () => {
  it("fails fast when DATABASE_URL is missing", () => {
    expect(() => loadDbConfig({})).toThrow(/DATABASE_URL/u);
  });

  it("rejects a blank DATABASE_URL", () => {
    expect(() => loadDbConfig({ DATABASE_URL: "   " })).toThrow(/DATABASE_URL/u);
  });

  it("returns the configured url", () => {
    expect(loadDbConfig({ DATABASE_URL: "postgresql://localhost:5432/slides_agent" })).toEqual({
      databaseUrl: "postgresql://localhost:5432/slides_agent"
    });
  });
});
