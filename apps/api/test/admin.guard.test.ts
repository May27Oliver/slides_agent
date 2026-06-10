import { describe, expect, it } from "vitest";
import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import { AdminGuard } from "@/modules/admin/admin.guard";

function contextFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) })
  } as unknown as ExecutionContext;
}

describe("AdminGuard", () => {
  const guard = new AdminGuard();

  it("allows a request whose live user is an admin", () => {
    expect(guard.canActivate(contextFor({ id: "u", isAdmin: true }))).toBe(true);
  });

  it("rejects a non-admin user with 403", () => {
    expect(() => guard.canActivate(contextFor({ id: "u", isAdmin: false }))).toThrow(
      ForbiddenException
    );
  });

  it("rejects when isAdmin is missing/undefined (fail closed)", () => {
    expect(() => guard.canActivate(contextFor({ id: "u" }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });
});
