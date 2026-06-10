import { describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "@/modules/auth/jwt.strategy";
import type { AuthService } from "@/modules/auth/auth.service";
import type { AuthConfig } from "@/config/auth.config";

function strategyWith(validateSessionUser: AuthService["validateSessionUser"]): JwtStrategy {
  const config = { jwtSecret: "test-secret" } as AuthConfig;
  return new JwtStrategy(config, { validateSessionUser } as unknown as AuthService);
}

describe("JwtStrategy", () => {
  it("returns the user (with live isAdmin) and token expiry for a valid active account", async () => {
    const strategy = strategyWith(
      vi.fn().mockResolvedValue({ id: "u", username: "a", displayName: "A", isAdmin: true })
    );

    const result = await strategy.validate({ sub: "u", exp: 1_893_456_000 });

    expect(result).toMatchObject({ id: "u", username: "a", displayName: "A", isAdmin: true });
    expect(result.expiresAt).toBe(new Date(1_893_456_000 * 1000).toISOString());
  });

  it("throws when the token's account is missing or inactive", async () => {
    const strategy = strategyWith(vi.fn().mockResolvedValue(null));
    await expect(strategy.validate({ sub: "u", exp: 1 })).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});
