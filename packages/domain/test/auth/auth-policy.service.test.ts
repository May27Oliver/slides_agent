import { describe, expect, it } from "vitest";
import { evaluateLogin, evaluateSession, toAuthenticatedUser } from "@/auth/auth-policy.service";
import type { UserAccount } from "@/auth/auth.types";

const account: UserAccount = {
  id: "user_owner",
  username: "owner@example.com",
  displayName: "Owner",
  passwordHash: "salt:hash",
  status: "active",
  isAdmin: true
};

describe("evaluateLogin", () => {
  it("returns the public user (with isAdmin) when account active and password matches", () => {
    expect(evaluateLogin(account, true)).toEqual({
      ok: true,
      user: { id: "user_owner", username: "owner@example.com", displayName: "Owner", isAdmin: true }
    });
  });

  it("classifies unknown account as invalid_credentials", () => {
    expect(evaluateLogin(undefined, false)).toEqual({ ok: false, code: "invalid_credentials" });
  });

  it("classifies wrong password as invalid_credentials", () => {
    expect(evaluateLogin(account, false)).toEqual({ ok: false, code: "invalid_credentials" });
  });

  // Order matters (DR-002): password is checked BEFORE status so a pending/disabled
  // account with a WRONG password still returns the generic invalid_credentials —
  // status is only revealed to someone holding the correct password (the owner).
  it("does not reveal pending status when the password is wrong (no enumeration)", () => {
    expect(evaluateLogin({ ...account, status: "pending" }, false)).toEqual({
      ok: false,
      code: "invalid_credentials"
    });
  });

  it("does not reveal disabled status when the password is wrong (no enumeration)", () => {
    expect(evaluateLogin({ ...account, status: "disabled" }, false)).toEqual({
      ok: false,
      code: "invalid_credentials"
    });
  });

  it("classifies a pending account (correct password) as account_pending", () => {
    expect(evaluateLogin({ ...account, status: "pending" }, true)).toEqual({
      ok: false,
      code: "account_pending"
    });
  });

  it("classifies a disabled account (correct password) as account_disabled", () => {
    expect(evaluateLogin({ ...account, status: "disabled" }, true)).toEqual({
      ok: false,
      code: "account_disabled"
    });
  });

  it("never leaks the password hash in the result", () => {
    const result = evaluateLogin(account, true);
    expect(JSON.stringify(result)).not.toContain("salt:hash");
  });
});

describe("evaluateSession", () => {
  it("accepts an active account from a valid token (with isAdmin)", () => {
    expect(evaluateSession(account)).toEqual({
      ok: true,
      user: { id: "user_owner", username: "owner@example.com", displayName: "Owner", isAdmin: true }
    });
  });

  it("rejects a token whose account no longer exists", () => {
    expect(evaluateSession(undefined)).toEqual({ ok: false, code: "invalid_token" });
  });

  it("rejects a token whose account was disabled", () => {
    expect(evaluateSession({ ...account, status: "disabled" })).toEqual({
      ok: false,
      code: "account_disabled"
    });
  });

  it("rejects a token whose account is still pending", () => {
    expect(evaluateSession({ ...account, status: "pending" })).toEqual({
      ok: false,
      code: "account_pending"
    });
  });
});

describe("toAuthenticatedUser", () => {
  it("carries isAdmin and omits the password hash", () => {
    expect(toAuthenticatedUser(account)).toEqual({
      id: "user_owner",
      username: "owner@example.com",
      displayName: "Owner",
      isAdmin: true
    });
  });

  it("defaults a non-admin account to isAdmin=false", () => {
    expect(toAuthenticatedUser({ ...account, isAdmin: false })).toMatchObject({ isAdmin: false });
  });
});
