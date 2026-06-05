import { describe, expect, it } from "vitest";
import { loadAuthConfig } from "@/config/auth.config";

const account = {
  id: "user_owner",
  username: "owner@example.com",
  displayName: "Owner",
  passwordHash: "salt:hash",
  active: true
};

describe("loadAuthConfig", () => {
  it("fails fast when AUTH_JWT_SECRET is missing", () => {
    expect(() => loadAuthConfig({})).toThrow(/AUTH_JWT_SECRET/u);
  });

  it("applies defaults and parses the account allowlist", () => {
    const config = loadAuthConfig({
      AUTH_JWT_SECRET: "secret",
      AUTH_ACCOUNTS: JSON.stringify([account])
    });
    expect(config.jwtExpiresIn).toBe("30d");
    expect(config.accounts).toEqual([account]);
    expect(config.loginRateLimit).toEqual({ max: 10, windowMs: 60000 });
  });

  it("defaults to an empty allowlist when AUTH_ACCOUNTS is unset", () => {
    expect(loadAuthConfig({ AUTH_JWT_SECRET: "secret" }).accounts).toEqual([]);
  });

  it("throws on invalid AUTH_ACCOUNTS JSON", () => {
    expect(() => loadAuthConfig({ AUTH_JWT_SECRET: "s", AUTH_ACCOUNTS: "{not json" })).toThrow(
      /AUTH_ACCOUNTS/u
    );
  });

  it("throws on a malformed account entry", () => {
    expect(() =>
      loadAuthConfig({ AUTH_JWT_SECRET: "s", AUTH_ACCOUNTS: JSON.stringify([{ id: "x" }]) })
    ).toThrow(/AUTH_ACCOUNTS\[0\]/u);
  });
});
