import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AuthContextValue, AuthStatus, StoredSession } from "@/features/auth/auth.types";
import { AUTH_STORAGE_KEY, clearSession, loadSession, saveSession } from "@/features/auth/auth-storage";
import { loginRequest, logoutRequest } from "@/features/auth/auth-client";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const tokenRef = useRef<string | undefined>(undefined);

  const applySession = useCallback((next: StoredSession | null) => {
    tokenRef.current = next?.token;
    setSession(next);
    setStatus(next ? "authenticated" : "unauthenticated");
  }, []);

  // Restore on mount.
  useEffect(() => {
    applySession(loadSession());
  }, [applySession]);

  // Cross-tab sync: a logout / token clear in another tab updates this one (FR-012).
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_STORAGE_KEY || event.key === null) {
        applySession(loadSession());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [applySession]);

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await loginRequest(username, password);
      const next: StoredSession = {
        token: result.token,
        expiresAt: result.expiresAt,
        user: result.user
      };
      saveSession(next);
      applySession(next);
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    const token = tokenRef.current;
    clearSession();
    applySession(null);
    await logoutRequest(token);
  }, [applySession]);

  const authFetch = useCallback<typeof fetch>(async (input, init) => {
    const headers = new Headers(init?.headers);
    if (tokenRef.current) {
      headers.set("authorization", `Bearer ${tokenRef.current}`);
    }
    const response = await fetch(input, { ...init, headers });
    if (response.status === 401) {
      clearSession();
      applySession(null);
    }
    return response;
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user: session?.user ?? null, login, logout, authFetch }),
    [status, session, login, logout, authFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
