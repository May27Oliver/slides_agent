// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminRoute } from "@/features/admin/AdminRoute";

const { authValue } = vi.hoisted(() => ({
  authValue: { status: "authenticated", user: { id: "u", isAdmin: false } } as {
    status: string;
    user: { id: string; isAdmin: boolean } | null;
  }
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => authValue }));

afterEach(cleanup);

function setup() {
  return render(
    <MemoryRouter initialEntries={["/admin/users"]}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin/users" element={<div>ADMIN DASHBOARD</div>} />
        </Route>
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminRoute", () => {
  it("redirects an authenticated non-admin to home", () => {
    authValue.status = "authenticated";
    authValue.user = { id: "u", isAdmin: false };
    setup();
    expect(screen.getByText("HOME")).toBeTruthy();
    expect(screen.queryByText("ADMIN DASHBOARD")).toBeNull();
  });

  it("renders the dashboard for an admin", () => {
    authValue.status = "authenticated";
    authValue.user = { id: "u", isAdmin: true };
    setup();
    expect(screen.getByText("ADMIN DASHBOARD")).toBeTruthy();
  });

  it("redirects an unauthenticated user to login", () => {
    authValue.status = "unauthenticated";
    authValue.user = null;
    setup();
    expect(screen.getByText("LOGIN")).toBeTruthy();
  });
});
