import { describe, expect, it } from "vitest";
import { validateLoginRequest, validateRegisterRequest } from "../src/auth";

describe("validateLoginRequest", () => {
  it("accepts a well-formed login request", () => {
    expect(validateLoginRequest({ username: "owner@example.com", password: "pw" })).toEqual({
      ok: true,
      value: { username: "owner@example.com", password: "pw" }
    });
  });

  it("rejects missing fields with INVALID_INPUT", () => {
    const result = validateLoginRequest({ username: "owner@example.com" });
    expect(result).toMatchObject({ ok: false, error: { code: "INVALID_INPUT", fields: ["password"] } });
  });

  it("rejects a non-object body", () => {
    expect(validateLoginRequest(null)).toMatchObject({ ok: false });
    expect(validateLoginRequest("nope")).toMatchObject({ ok: false });
  });

  it("rejects an over-long username", () => {
    const result = validateLoginRequest({ username: "a".repeat(321), password: "pw" });
    expect(result).toMatchObject({ ok: false, error: { fields: ["username"] } });
  });
});

describe("validateRegisterRequest", () => {
  const valid = {
    username: "new.user@example.com",
    displayName: "New User",
    password: "abc123def4" // 10 chars, letter + digit
  };

  it("accepts a well-formed registration request", () => {
    expect(validateRegisterRequest(valid)).toEqual({ ok: true, value: valid });
  });

  it("trims the username but preserves the password verbatim", () => {
    const result = validateRegisterRequest({ ...valid, username: "  new.user@example.com  " });
    expect(result).toMatchObject({ ok: true, value: { username: "new.user@example.com" } });
  });

  it("rejects a non-object body", () => {
    expect(validateRegisterRequest(null)).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
  });

  it("rejects a missing/blank email username", () => {
    expect(validateRegisterRequest({ ...valid, username: "   " })).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT", fields: ["username"] }
    });
  });

  it("rejects a malformed email", () => {
    expect(validateRegisterRequest({ ...valid, username: "not-an-email" })).toMatchObject({
      ok: false,
      error: { fields: ["username"] }
    });
  });

  it("rejects a missing display name", () => {
    expect(validateRegisterRequest({ ...valid, displayName: "" })).toMatchObject({
      ok: false,
      error: { fields: ["displayName"] }
    });
  });

  it("rejects a password shorter than 10 characters", () => {
    expect(validateRegisterRequest({ ...valid, password: "abc12" })).toMatchObject({
      ok: false,
      error: { fields: ["password"] }
    });
  });

  it("rejects a password with no digit", () => {
    expect(validateRegisterRequest({ ...valid, password: "abcdefghij" })).toMatchObject({
      ok: false,
      error: { fields: ["password"] }
    });
  });

  it("rejects a password with no letter", () => {
    expect(validateRegisterRequest({ ...valid, password: "1234567890" })).toMatchObject({
      ok: false,
      error: { fields: ["password"] }
    });
  });

  it("rejects an over-long username", () => {
    expect(
      validateRegisterRequest({ ...valid, username: `${"a".repeat(320)}@x.com` })
    ).toMatchObject({ ok: false, error: { fields: ["username"] } });
  });
});
