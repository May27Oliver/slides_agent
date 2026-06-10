import { describe, expect, it, vi } from "vitest";
import {
  AdminApiError,
  deleteUser,
  listUsers,
  updateUser
} from "@/features/admin/admin-users-client";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

const row = {
  id: "u1",
  username: "a@example.com",
  displayName: "A",
  status: "pending" as const,
  isAdmin: false,
  createdAt: "2026-06-10T00:00:00.000Z"
};

describe("admin-users-client", () => {
  it("listUsers omits the query for 'all' and appends ?status otherwise", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ users: [row] }));
    expect(await listUsers("all", fetchImpl)).toEqual([row]);
    expect(fetchImpl.mock.calls[0]![0]).toBe("/api/admin/users");

    await listUsers("pending", fetchImpl);
    expect(fetchImpl.mock.calls[1]![0]).toBe("/api/admin/users?status=pending");
  });

  it("updateUser PATCHes the body and returns the updated account", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ...row, status: "active" }));
    const result = await updateUser("u1", { status: "active" }, fetchImpl);
    expect(result.status).toBe("active");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/admin/users/u1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ status: "active" });
  });

  it("deleteUser DELETEs the account", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(undefined, true, 204));
    await deleteUser("u1", fetchImpl);
    expect(fetchImpl.mock.calls[0]![1].method).toBe("DELETE");
  });

  it("surfaces the server error code as AdminApiError", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "LAST_ADMIN_PROTECTED" }, false, 409));
    await expect(updateUser("u1", { isAdmin: false }, fetchImpl)).rejects.toMatchObject({
      name: "AdminApiError",
      code: "LAST_ADMIN_PROTECTED"
    });
    expect(AdminApiError).toBeDefined();
  });
});
