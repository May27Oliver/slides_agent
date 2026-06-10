import { describe, expect, it, vi } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type { AccountAdminStore, AdminAccountView } from "@slides-agent/domain";
import { AdminUsersController } from "@/modules/admin/admin-users.controller";

function view(over: Partial<AdminAccountView> = {}): AdminAccountView {
  return {
    id: "user_target",
    username: "t@example.com",
    displayName: "Target",
    status: "active",
    isAdmin: false,
    createdAt: "2026-06-10T00:00:00.000Z",
    ...over
  };
}

function makeController(store: Partial<AccountAdminStore>): AdminUsersController {
  return new AdminUsersController(store as AccountAdminStore);
}

const actor = { user: { id: "admin_self" } };

describe("AdminUsersController.list", () => {
  it("returns all users when no filter is given", async () => {
    const listAll = vi.fn().mockResolvedValue([view()]);
    const controller = makeController({ listAll });
    expect(await controller.list()).toEqual({ users: [view()] });
    expect(listAll).toHaveBeenCalledWith(undefined);
  });

  it("passes a status filter through (and treats 'all' as no filter)", async () => {
    const listAll = vi.fn().mockResolvedValue([]);
    const controller = makeController({ listAll });
    await controller.list("pending");
    expect(listAll).toHaveBeenCalledWith({ status: "pending" });
    await controller.list("all");
    expect(listAll).toHaveBeenLastCalledWith(undefined);
  });

  it("rejects an unknown status filter with 400", async () => {
    const controller = makeController({ listAll: vi.fn() });
    await expect(controller.list("bogus")).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("AdminUsersController.update", () => {
  it("approves a pending account (status -> active)", async () => {
    const getById = vi.fn().mockResolvedValue(view({ status: "pending" }));
    const updateStatus = vi.fn().mockResolvedValue(view({ status: "active" }));
    const controller = makeController({ getById, updateStatus, countActiveAdmins: vi.fn() });

    const result = await controller.update("user_target", { status: "active" }, actor);
    expect(result.status).toBe("active");
    expect(updateStatus).toHaveBeenCalledWith("user_target", "active");
  });

  it("promotes a user to admin", async () => {
    const getById = vi.fn().mockResolvedValue(view());
    const setAdmin = vi.fn().mockResolvedValue(view({ isAdmin: true }));
    const controller = makeController({ getById, setAdmin, countActiveAdmins: vi.fn() });

    const result = await controller.update("user_target", { isAdmin: true }, actor);
    expect(result.isAdmin).toBe(true);
    expect(setAdmin).toHaveBeenCalledWith("user_target", true);
  });

  it("404s when the target does not exist", async () => {
    const controller = makeController({ getById: vi.fn().mockResolvedValue(undefined) });
    await expect(
      controller.update("missing", { status: "active" }, actor)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("400s on an empty body", async () => {
    const controller = makeController({ getById: vi.fn() });
    await expect(controller.update("user_target", {}, actor)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("409 LAST_ADMIN_PROTECTED when demoting the last active admin", async () => {
    const getById = vi.fn().mockResolvedValue(view({ id: "admin_b", isAdmin: true, status: "active" }));
    const countActiveAdmins = vi.fn().mockResolvedValue(1);
    const setAdmin = vi.fn();
    const controller = makeController({ getById, countActiveAdmins, setAdmin });

    await expect(
      controller.update("admin_b", { isAdmin: false }, actor)
    ).rejects.toMatchObject({ response: { code: "LAST_ADMIN_PROTECTED" } });
    expect(setAdmin).not.toHaveBeenCalled();
  });

  it("409 CANNOT_MODIFY_SELF when disabling yourself", async () => {
    const getById = vi
      .fn()
      .mockResolvedValue(view({ id: "admin_self", isAdmin: true, status: "active" }));
    const countActiveAdmins = vi.fn().mockResolvedValue(3);
    const updateStatus = vi.fn();
    const controller = makeController({ getById, countActiveAdmins, updateStatus });

    await expect(
      controller.update("admin_self", { status: "disabled" }, actor)
    ).rejects.toMatchObject({ response: { code: "CANNOT_MODIFY_SELF" } });
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("allows demoting an admin when other active admins remain", async () => {
    const getById = vi.fn().mockResolvedValue(view({ id: "admin_b", isAdmin: true, status: "active" }));
    const countActiveAdmins = vi.fn().mockResolvedValue(2);
    const setAdmin = vi.fn().mockResolvedValue(view({ id: "admin_b", isAdmin: false }));
    const controller = makeController({ getById, countActiveAdmins, setAdmin });

    const result = await controller.update("admin_b", { isAdmin: false }, actor);
    expect(result.isAdmin).toBe(false);
  });
});

describe("AdminUsersController.remove", () => {
  it("deletes a pending account", async () => {
    const getById = vi.fn().mockResolvedValue(view({ status: "pending" }));
    const deleteById = vi.fn().mockResolvedValue(true);
    const controller = makeController({ getById, deleteById });

    await expect(controller.remove("user_target")).resolves.toBeUndefined();
    expect(deleteById).toHaveBeenCalledWith("user_target");
  });

  it("409 CANNOT_REJECT_NON_PENDING for an active account", async () => {
    const getById = vi.fn().mockResolvedValue(view({ status: "active" }));
    const deleteById = vi.fn();
    const controller = makeController({ getById, deleteById });

    await expect(controller.remove("user_target")).rejects.toMatchObject({
      response: { code: "CANNOT_REJECT_NON_PENDING" }
    });
    expect(deleteById).not.toHaveBeenCalled();
  });

  it("404 when deleting a missing account", async () => {
    const controller = makeController({ getById: vi.fn().mockResolvedValue(undefined) });
    await expect(controller.remove("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
