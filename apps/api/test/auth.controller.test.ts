import { describe, expect, it, vi } from "vitest";
import { AuthController } from "@/modules/auth/auth.controller";
import type { AuthService } from "@/modules/auth/auth.service";
import type { AuthedRequestUser } from "@/modules/auth/jwt.strategy";

function controllerWith(authService: Partial<AuthService>): AuthController {
  return new AuthController(authService as AuthService);
}

describe("AuthController", () => {
  it("login issues a session from the guard-validated user", async () => {
    const session = {
      token: "jwt",
      expiresAt: "2026-07-03T00:00:00.000Z",
      user: { id: "u", username: "a", displayName: "A" }
    };
    const issueSession = vi.fn().mockResolvedValue(session);
    const controller = controllerWith({ issueSession });

    const user = { id: "u", username: "a", displayName: "A" } as AuthedRequestUser;
    const result = await controller.login({ user });

    expect(result).toEqual(session);
    expect(issueSession).toHaveBeenCalledWith(user);
  });

  it("me returns the authenticated user and token expiry", () => {
    const controller = controllerWith({});
    const user: AuthedRequestUser = {
      id: "u",
      username: "a",
      displayName: "A",
      expiresAt: "2026-07-03T00:00:00.000Z"
    };

    expect(controller.me({ user })).toEqual({
      authenticated: true,
      expiresAt: "2026-07-03T00:00:00.000Z",
      user: { id: "u", username: "a", displayName: "A" }
    });
  });

  it("logout is a no-op (204)", () => {
    expect(controllerWith({}).logout()).toBeUndefined();
  });
});
