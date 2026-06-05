import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/common/scrypt-password";

describe("scrypt password", () => {
  it("verifies a correct password against its own hash", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("right");
    expect(verifyPassword("wrong", stored)).toBe(false);
  });

  it("produces a different salt each time (no static hash)", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("rejects malformed stored values", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "no-colon")).toBe(false);
  });
});
