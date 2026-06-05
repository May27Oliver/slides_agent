// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { AUTH_STORAGE_KEY } from "@/features/auth/auth-storage";

const session = {
  token: "jwt",
  expiresAt: "2026-07-03T00:00:00.000Z",
  user: { id: "u", username: "owner@example.com", displayName: "Owner" }
};

function stubFetch(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body } as Response)
  );
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider });
}

describe("AuthProvider", () => {
  it("starts unauthenticated then logs in and persists", async () => {
    stubFetch(session);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    await act(async () => {
      await result.current.login("owner@example.com", "pw");
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.user).toEqual(session.user);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeTruthy();
  });

  it("restores a stored session on mount", async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.user).toEqual(session.user);
  });

  it("logs out and clears storage", async () => {
    stubFetch(undefined);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("syncs logout across tabs via storage events (FR-012)", async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    await act(async () => {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: AUTH_STORAGE_KEY }));
    });

    expect(result.current.status).toBe("unauthenticated");
  });
});
