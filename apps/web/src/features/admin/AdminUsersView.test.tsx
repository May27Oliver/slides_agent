// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PublicAccount } from "@slides-agent/contracts";
import { AdminUsersView } from "@/features/admin/AdminUsersView";
import { AdminApiError } from "@/features/admin/admin-users-client";

const { authValue } = vi.hoisted(() => ({
  authValue: {
    authFetch: () => Promise.resolve(new Response()),
    user: { id: "admin_self", displayName: "Admin", isAdmin: true }
  }
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => authValue }));

const listUsers = vi.fn();
const updateUser = vi.fn();
const deleteUser = vi.fn();
vi.mock("@/features/admin/admin-users-client", async (importActual) => {
  const actual = await importActual<typeof import("@/features/admin/admin-users-client")>();
  return {
    ...actual,
    listUsers: (...a: unknown[]) => listUsers(...a),
    updateUser: (...a: unknown[]) => updateUser(...a),
    deleteUser: (...a: unknown[]) => deleteUser(...a)
  };
});

afterEach(() => {
  cleanup();
  listUsers.mockReset();
  updateUser.mockReset();
  deleteUser.mockReset();
});

const pending: PublicAccount = {
  id: "user_p",
  username: "pending@example.com",
  displayName: "Pending User",
  status: "pending",
  isAdmin: false,
  createdAt: "2026-06-10T00:00:00.000Z"
};

const self: PublicAccount = {
  id: "admin_self",
  username: "admin@example.com",
  displayName: "Admin",
  status: "active",
  isAdmin: true,
  createdAt: "2026-06-09T00:00:00.000Z"
};

function setup() {
  return render(
    <MemoryRouter>
      <AdminUsersView />
    </MemoryRouter>
  );
}

describe("AdminUsersView", () => {
  it("lists users and approves a pending account, then refreshes", async () => {
    listUsers.mockResolvedValue([pending]);
    updateUser.mockResolvedValue({ ...pending, status: "active" });
    setup();

    expect(await screen.findByText("pending@example.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "核准" }));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith("user_p", { status: "active" }, expect.anything())
    );
    // initial load + post-action refresh
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it("shows a friendly message when the server rejects with LAST_ADMIN_PROTECTED", async () => {
    listUsers.mockResolvedValue([{ ...self, id: "admin_b", username: "b@example.com" }]);
    updateUser.mockRejectedValue(new AdminApiError("LAST_ADMIN_PROTECTED"));
    setup();

    expect(await screen.findByText("b@example.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "取消管理員" }));

    expect(await screen.findByText("無法移除最後一位啟用中的管理員。")).toBeTruthy();
  });

  it("hides disable/demote actions on your own row", async () => {
    listUsers.mockResolvedValue([self]);
    setup();

    expect(await screen.findByText("admin@example.com")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "停用" })).toBeNull();
    expect(screen.getByText("（你自己）")).toBeTruthy();
  });
});
