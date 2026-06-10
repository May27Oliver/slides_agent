import { describe, expect, it, vi } from "vitest";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import type { AccountAdminStore, AdminAccountView, UserAccountStore } from "@slides-agent/domain";
import { RegisterController } from "@/modules/auth/register.controller";
import type { AuthConfig } from "@/config/auth.config";
import { verifyPassword } from "@/common/scrypt-password";

const validBody = {
  username: "New.User@Example.com",
  displayName: "New User",
  password: "abc123def4"
};

const createdView: AdminAccountView = {
  id: "user_generated",
  username: "new.user@example.com",
  displayName: "New User",
  status: "pending",
  isAdmin: false,
  createdAt: "2026-06-10T00:00:00.000Z"
};

function makeController(opts: {
  registrationEnabled?: boolean;
  existing?: boolean;
  create?: AccountAdminStore["create"];
}): {
  controller: RegisterController;
  create: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn().mockResolvedValue(createdView) as ReturnType<typeof vi.fn>;
  const adminStore = { create: opts.create ?? create } as unknown as AccountAdminStore;
  const userStore = {
    findByUsername: vi.fn().mockResolvedValue(opts.existing ? { id: "x" } : undefined),
    findById: vi.fn()
  } as unknown as UserAccountStore;
  const config = { registrationEnabled: opts.registrationEnabled ?? true } as AuthConfig;
  return { controller: new RegisterController(adminStore, userStore, config), create };
}

describe("RegisterController", () => {
  it("creates a pending account and returns the public view (no token, no hash)", async () => {
    const { controller, create } = makeController({});
    const result = await controller.register(validBody);

    expect(result).toEqual(createdView);
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("token");

    const arg = create.mock.calls[0][0];
    // Controller forwards the trimmed username; the store normalizes (lowercases) it.
    expect(arg).toMatchObject({
      status: "pending",
      isAdmin: false,
      username: "New.User@Example.com"
    });
    // The stored hash must be a scrypt verifier, never the plaintext password.
    expect(arg.passwordHash).not.toBe(validBody.password);
    expect(verifyPassword(validBody.password, arg.passwordHash)).toBe(true);
    expect(typeof arg.id).toBe("string");
    expect(arg.id.length).toBeGreaterThan(0);
  });

  it("rejects an invalid body with 400 INVALID_INPUT", async () => {
    const { controller, create } = makeController({});
    await expect(controller.register({ ...validBody, password: "short" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate email with 409", async () => {
    const { controller, create } = makeController({ existing: true });
    await expect(controller.register(validBody)).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 403 REGISTRATION_DISABLED when registration is off", async () => {
    const { controller, create } = makeController({ registrationEnabled: false });
    await expect(controller.register(validBody)).rejects.toMatchObject({
      response: { code: "REGISTRATION_DISABLED" }
    });
    await expect(controller.register(validBody)).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint race to 409", async () => {
    const conflict = Object.assign(new Error("dup"), { code: "23505" });
    const create = vi.fn().mockRejectedValue(conflict);
    const { controller } = makeController({
      create: create as unknown as AccountAdminStore["create"]
    });
    await expect(controller.register(validBody)).rejects.toBeInstanceOf(ConflictException);
  });
});
