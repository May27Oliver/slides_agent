import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/common/scrypt-password";

describe("scrypt password", () => {
  it("verifies a correct password against its own hash", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("right");
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("produces a different salt each time (no static hash)", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored values", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "no-colon")).toBe(false);
  });
});
