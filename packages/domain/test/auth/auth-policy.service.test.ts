import { describe, expect, it } from "vitest";
import { evaluateLogin, evaluateSession } from "@/auth/auth-policy.service";
import type { UserAccount } from "@/auth/auth.types";

const account: UserAccount = {
  id: "user_owner",
  username: "owner@example.com",
  displayName: "Owner",
  passwordHash: "salt:hash",
  active: true
};

describe("evaluateLogin", () => {
  it("returns the public user when account active and password matches", () => {
    expect(evaluateLogin(account, true)).toEqual({
      ok: true,
      user: { id: "user_owner", username: "owner@example.com", displayName: "Owner" }
    });
  });

  it("classifies unknown account as invalid_credentials", () => {
    expect(evaluateLogin(undefined, false)).toEqual({ ok: false, code: "invalid_credentials" });
  });

  it("classifies wrong password as invalid_credentials", () => {
    expect(evaluateLogin(account, false)).toEqual({ ok: false, code: "invalid_credentials" });
  });

  it("classifies inactive account as inactive_account", () => {
    expect(evaluateLogin({ ...account, active: false }, true)).toEqual({
      ok: false,
      code: "inactive_account"
    });
  });

  it("never leaks the password hash in the result", () => {
    const result = evaluateLogin(account, true);
    expect(JSON.stringify(result)).not.toContain("salt:hash");
  });
});

describe("evaluateSession", () => {
  it("accepts an active account from a valid token", () => {
    expect(evaluateSession(account)).toEqual({
      ok: true,
      user: { id: "user_owner", username: "owner@example.com", displayName: "Owner" }
    });
  });

  it("rejects a token whose account no longer exists", () => {
    expect(evaluateSession(undefined)).toEqual({ ok: false, code: "invalid_token" });
  });

  it("rejects a token whose account was disabled", () => {
    expect(evaluateSession({ ...account, active: false })).toEqual({
      ok: false,
      code: "inactive_account"
    });
  });
});
