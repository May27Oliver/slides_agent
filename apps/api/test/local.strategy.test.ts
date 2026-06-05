import { describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { LocalStrategy } from "@/modules/auth/local.strategy";
import type { AuthService } from "@/modules/auth/auth.service";

function strategyWith(validateCredentials: AuthService["validateCredentials"]): LocalStrategy {
  return new LocalStrategy({ validateCredentials } as unknown as AuthService);
}

describe("LocalStrategy", () => {
  it("returns the user when credentials are valid", async () => {
    const user = { id: "u", username: "a", displayName: "A" };
    const strategy = strategyWith(vi.fn().mockResolvedValue(user));
    expect(await strategy.validate("a", "pw")).toEqual(user);
  });

  it("throws Unauthorized when credentials are invalid", async () => {
    const strategy = strategyWith(vi.fn().mockResolvedValue(null));
    await expect(strategy.validate("a", "bad")).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
