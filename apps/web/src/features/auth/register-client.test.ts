import { describe, expect, it, vi } from "vitest";
import { fetchAuthConfig, RegisterError, registerRequest } from "@/features/auth/register-client";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

const body = { username: "new@example.com", displayName: "New", password: "abc123def4" };

describe("register-client", () => {
  it("registerRequest posts the body and returns the pending account", async () => {
    const account = {
      id: "user_x",
      username: "new@example.com",
      displayName: "New",
      status: "pending",
      isAdmin: false,
      createdAt: "2026-06-10T00:00:00.000Z"
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(account, true, 201));

    const result = await registerRequest(body, fetchImpl);

    expect(result).toEqual(account);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/auth/register");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(body);
  });

  it("registerRequest throws RegisterError carrying the server code on conflict", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "INVALID_INPUT", message: "dup" }, false, 409));
    await expect(registerRequest(body, fetchImpl)).rejects.toMatchObject({
      name: "RegisterError",
      code: "INVALID_INPUT"
    });
  });

  it("registerRequest surfaces REGISTRATION_DISABLED (403)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "REGISTRATION_DISABLED" }, false, 403));
    await expect(registerRequest(body, fetchImpl)).rejects.toBeInstanceOf(RegisterError);
    await expect(registerRequest(body, fetchImpl)).rejects.toMatchObject({
      code: "REGISTRATION_DISABLED"
    });
  });

  it("fetchAuthConfig returns the flag, defaulting to enabled on failure", async () => {
    const ok = vi.fn().mockResolvedValue(jsonResponse({ registrationEnabled: false }));
    expect(await fetchAuthConfig(ok)).toEqual({ registrationEnabled: false });

    const broken = vi.fn().mockRejectedValue(new Error("network"));
    expect(await fetchAuthConfig(broken)).toEqual({ registrationEnabled: true });
  });
});
