import { describe, expect, it } from "vitest";
import { validateLoginRequest } from "../src/auth";

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
