// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LoginView } from "@/features/auth/LoginView";
import { AuthError } from "@/features/auth/auth-client";

const { authValue } = vi.hoisted(() => ({
  authValue: { status: "unauthenticated", login: vi.fn() } as {
    status: string;
    login: ReturnType<typeof vi.fn>;
  }
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => authValue }));
vi.mock("@/features/auth/register-client", () => ({
  fetchAuthConfig: () => Promise.resolve({ registrationEnabled: false })
}));

afterEach(() => {
  cleanup();
  authValue.login.mockReset();
});

function submit() {
  fireEvent.change(screen.getByLabelText("帳號"), { target: { value: "a@example.com" } });
  fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "pw" } });
  fireEvent.click(screen.getByRole("button", { name: "登入" }));
}

function setup() {
  return render(
    <MemoryRouter>
      <LoginView />
    </MemoryRouter>
  );
}

describe("LoginView error messaging (US3)", () => {
  it("shows the awaiting-approval message for ACCOUNT_PENDING", async () => {
    authValue.login.mockRejectedValue(new AuthError("x", "ACCOUNT_PENDING"));
    setup();
    submit();
    expect(await screen.findByText("帳號尚待管理員核准，核准後即可登入。")).toBeTruthy();
  });

  it("shows the disabled message for ACCOUNT_DISABLED", async () => {
    authValue.login.mockRejectedValue(new AuthError("x", "ACCOUNT_DISABLED"));
    setup();
    submit();
    expect(await screen.findByText("此帳號已被停用，請聯絡管理員。")).toBeTruthy();
  });

  it("shows the generic message for a credential failure (no enumeration)", async () => {
    authValue.login.mockRejectedValue(new AuthError("x", "AUTH_INVALID"));
    setup();
    submit();
    expect(await screen.findByText("登入失敗，請確認帳號與密碼")).toBeTruthy();
  });
});
