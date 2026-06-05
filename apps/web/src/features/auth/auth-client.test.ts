import { describe, expect, it, vi } from "vitest";
import { AuthError, loginRequest, logoutRequest } from "@/features/auth/auth-client";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body
  } as unknown as Response;
}

describe("auth-client", () => {
  it("loginRequest posts credentials and returns the session", async () => {
    const session = {
      token: "jwt",
      expiresAt: "2026-07-03T00:00:00.000Z",
      user: { id: "u", username: "owner@example.com", displayName: "Owner" }
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(session));

    const result = await loginRequest("owner@example.com", "pw", fetchImpl);

    expect(result).toEqual(session);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ username: "owner@example.com", password: "pw" });
  });

  it("loginRequest throws AuthError on non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ code: "AUTH_INVALID" }, false, 401));
    await expect(loginRequest("a", "bad", fetchImpl)).rejects.toBeInstanceOf(AuthError);
  });

  it("logoutRequest sends the bearer token and swallows network errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(undefined, true, 204));
    await logoutRequest("jwt", fetchImpl);
    expect(fetchImpl.mock.calls[0]![1].headers).toEqual({ authorization: "Bearer jwt" });

    const failing = vi.fn().mockRejectedValue(new Error("network"));
    await expect(logoutRequest("jwt", failing)).resolves.toBeUndefined();
  });
});
