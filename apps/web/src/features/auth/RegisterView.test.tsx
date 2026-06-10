// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RegisterView } from "@/features/auth/RegisterView";
import { RegisterError } from "@/features/auth/register-client";

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({ status: "unauthenticated" })
}));

const registerRequest = vi.fn();
const fetchAuthConfig = vi.fn();
vi.mock("@/features/auth/register-client", async (importActual) => {
  const actual = await importActual<typeof import("@/features/auth/register-client")>();
  return {
    ...actual,
    registerRequest: (...args: unknown[]) => registerRequest(...args),
    fetchAuthConfig: (...args: unknown[]) => fetchAuthConfig(...args)
  };
});

afterEach(() => {
  cleanup();
  registerRequest.mockReset();
  fetchAuthConfig.mockReset();
});

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "new.user@example.com" }
  });
  fireEvent.change(screen.getByLabelText("顯示名稱"), { target: { value: "New User" } });
  fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "abc123def4" } });
  fireEvent.click(screen.getByRole("button", { name: "註冊" }));
}

function setup() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterView />} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RegisterView", () => {
  it("submits a valid form and shows the pending-approval confirmation (no auto-login)", async () => {
    fetchAuthConfig.mockResolvedValue({ registrationEnabled: true });
    registerRequest.mockResolvedValue({
      id: "user_x",
      username: "new.user@example.com",
      displayName: "New User",
      status: "pending",
      isAdmin: false,
      createdAt: "2026-06-10T00:00:00.000Z"
    });
    setup();

    fillAndSubmit();

    expect(await screen.findByText("註冊已送出")).toBeTruthy();
    expect(registerRequest).toHaveBeenCalledWith({
      username: "new.user@example.com",
      displayName: "New User",
      password: "abc123def4"
    });
    expect(screen.getByText("回登入頁")).toBeTruthy();
  });

  it("shows a duplicate-email message on a 409 USERNAME_TAKEN conflict", async () => {
    fetchAuthConfig.mockResolvedValue({ registrationEnabled: true });
    registerRequest.mockRejectedValue(new RegisterError("USERNAME_TAKEN", "dup", []));
    setup();

    fillAndSubmit();

    expect(await screen.findByText("此 email 已被使用。")).toBeTruthy();
  });

  it("shows a live password error while the typed password breaks the policy", async () => {
    fetchAuthConfig.mockResolvedValue({ registrationEnabled: true });
    setup();

    fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "short" } });
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("密碼不符上述規則，請再調整。")).toBeTruthy();

    // A compliant password clears the live error.
    fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "abc123def4" } });
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(registerRequest).not.toHaveBeenCalled();
  });

  it("shows a closed-registration notice when the config flag is off", async () => {
    fetchAuthConfig.mockResolvedValue({ registrationEnabled: false });
    setup();

    await waitFor(() => expect(screen.getByText("目前未開放註冊")).toBeTruthy());
  });
});
