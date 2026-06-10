import { describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
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
  it("forwards the change + actor to the atomic store mutation and returns its account", async () => {
    const applyAdminMutation = vi
      .fn()
      .mockResolvedValue({ status: "ok", account: view({ status: "active" }) });
    const controller = makeController({ applyAdminMutation });

    const result = await controller.update("user_target", { status: "active" }, actor);
    expect(result.status).toBe("active");
    expect(applyAdminMutation).toHaveBeenCalledWith({
      actorId: "admin_self",
      targetId: "user_target",
      status: "active",
      isAdmin: undefined
    });
  });

  it("404 ACCOUNT_NOT_FOUND when the store reports the target is gone", async () => {
    const applyAdminMutation = vi.fn().mockResolvedValue({ status: "not_found" });
    const controller = makeController({ applyAdminMutation });
    await expect(controller.update("missing", { status: "active" }, actor)).rejects.toMatchObject({
      response: { code: "ACCOUNT_NOT_FOUND" }
    });
  });

  it("400s on an empty body (before touching the store)", async () => {
    const applyAdminMutation = vi.fn();
    const controller = makeController({ applyAdminMutation });
    await expect(controller.update("user_target", {}, actor)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(applyAdminMutation).not.toHaveBeenCalled();
  });

  it("400s when trying to SET a non-settable status (pending) — FR-010", async () => {
    const applyAdminMutation = vi.fn();
    const controller = makeController({ applyAdminMutation });
    await expect(
      controller.update(
        "user_target",
        { status: "pending" } as unknown as Parameters<AdminUsersController["update"]>[1],
        actor
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(applyAdminMutation).not.toHaveBeenCalled();
  });

  it("409 LAST_ADMIN_PROTECTED when the store refuses (last active admin)", async () => {
    const applyAdminMutation = vi
      .fn()
      .mockResolvedValue({ status: "lockout", code: "LAST_ADMIN_PROTECTED" });
    const controller = makeController({ applyAdminMutation });
    await expect(controller.update("admin_b", { isAdmin: false }, actor)).rejects.toMatchObject({
      response: { code: "LAST_ADMIN_PROTECTED" }
    });
  });

  it("409 CANNOT_MODIFY_SELF when the store refuses self-modification", async () => {
    const applyAdminMutation = vi
      .fn()
      .mockResolvedValue({ status: "lockout", code: "CANNOT_MODIFY_SELF" });
    const controller = makeController({ applyAdminMutation });
    await expect(
      controller.update("admin_self", { status: "disabled" }, actor)
    ).rejects.toMatchObject({ response: { code: "CANNOT_MODIFY_SELF" } });
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
