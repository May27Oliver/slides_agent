import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { AuthEvaluation } from "@slides-agent/domain";
import { LocalStrategy } from "@/modules/auth/local.strategy";
import type { AuthService } from "@/modules/auth/auth.service";

function strategyWith(result: AuthEvaluation): LocalStrategy {
  const validateCredentials = vi.fn().mockResolvedValue(result);
  return new LocalStrategy({ validateCredentials } as unknown as AuthService);
}

const user = { id: "u", username: "a", displayName: "A", isAdmin: false };

describe("LocalStrategy", () => {
  it("returns the user when credentials are valid", async () => {
    const strategy = strategyWith({ ok: true, user });
    expect(await strategy.validate("a", "pw")).toEqual(user);
  });

  it("throws generic Unauthorized when credentials are invalid", async () => {
    const strategy = strategyWith({ ok: false, code: "invalid_credentials" });
    await expect(strategy.validate("a", "bad")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws Forbidden ACCOUNT_PENDING for a pending owner", async () => {
    const strategy = strategyWith({ ok: false, code: "account_pending" });
    await expect(strategy.validate("a", "pw")).rejects.toMatchObject({
      response: { code: "ACCOUNT_PENDING" }
    });
    await expect(strategy.validate("a", "pw")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws Forbidden ACCOUNT_DISABLED for a disabled owner", async () => {
    const strategy = strategyWith({ ok: false, code: "account_disabled" });
    await expect(strategy.validate("a", "pw")).rejects.toMatchObject({
      response: { code: "ACCOUNT_DISABLED" }
    });
  });

  it("rejects malformed credentials before hitting the service (generic 401)", async () => {
    const strategy = strategyWith({ ok: true, user });
    await expect(strategy.validate("", "")).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
