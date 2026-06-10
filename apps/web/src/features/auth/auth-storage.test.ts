// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  AUTH_STORAGE_KEY,
  clearSession,
  loadSession,
  saveSession
} from "@/features/auth/auth-storage";

const session = {
  token: "jwt",
  expiresAt: "2026-07-03T00:00:00.000Z",
  user: { id: "u", username: "owner@example.com", displayName: "Owner", isAdmin: false }
};

afterEach(() => localStorage.clear());

describe("auth-storage", () => {
  it("round-trips a session", () => {
    saveSession(session);
    expect(loadSession()).toEqual(session);
  });

  it("clears the session", () => {
    saveSession(session);
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it("returns null for missing or malformed data", () => {
    expect(loadSession()).toBeNull();
    localStorage.setItem(AUTH_STORAGE_KEY, "{not json");
    expect(loadSession()).toBeNull();
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: 123 }));
    expect(loadSession()).toBeNull();
  });
});
