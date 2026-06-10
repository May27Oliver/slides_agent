import { describe, expect, it } from "vitest";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "@/modules/auth/jwt-auth.guard";
import { LocalAuthGuard } from "@/modules/auth/local-auth.guard";

describe("JwtAuthGuard.handleRequest", () => {
  const guard = new JwtAuthGuard();

  it("returns the user when authentication succeeded", () => {
    expect(guard.handleRequest(null, { id: "u" })).toEqual({ id: "u" });
  });

  it("throws sanitized AUTH_REQUIRED when there is no user", () => {
    expect.assertions(2);
    try {
      guard.handleRequest(null, null);
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: "AUTH_REQUIRED"
      });
    }
  });

  it("throws on an underlying error", () => {
    expect(() => guard.handleRequest(new Error("boom"), null)).toThrow(UnauthorizedException);
  });
});

describe("LocalAuthGuard.handleRequest", () => {
  const guard = new LocalAuthGuard();

  it("throws sanitized AUTH_INVALID when credentials fail", () => {
    expect.assertions(1);
    try {
      guard.handleRequest(null, null);
    } catch (error) {
      expect((error as UnauthorizedException).getResponse()).toMatchObject({
        code: "AUTH_INVALID"
      });
    }
  });

  it("preserves a ForbiddenException (ACCOUNT_PENDING/DISABLED) from the strategy", () => {
    const forbidden = new ForbiddenException({ code: "ACCOUNT_PENDING", message: "pending" });
    expect(() => guard.handleRequest(forbidden, null)).toThrow(ForbiddenException);
    try {
      guard.handleRequest(forbidden, null);
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: "ACCOUNT_PENDING"
      });
    }
  });
});
