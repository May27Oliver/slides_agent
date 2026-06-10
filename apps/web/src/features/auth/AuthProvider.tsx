import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { ReactNode } from "react";
import type { AuthContextValue, AuthStatus, StoredSession } from "@/features/auth/auth.types";
import {
  AUTH_STORAGE_KEY,
  clearSession,
  loadSession,
  saveSession
} from "@/features/auth/auth-storage";
import { AuthError, loginRequest, logoutRequest, meRequest } from "@/features/auth/auth-client";

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

  // Reconcile the stored session against the live DB (FR-017a): refresh user
  // (notably isAdmin) + expiry from /api/auth/me. On a 401-class AuthError the
  // account is gone/disabled → drop the session; a transient network error keeps
  // the restored session as-is (no surprise logout when the API is briefly down).
  const reconcileSession = useCallback(
    async (token: string) => {
      try {
        const me = await meRequest(token);
        const next: StoredSession = { token, expiresAt: me.expiresAt, user: me.user };
        saveSession(next);
        applySession(next);
      } catch (error) {
        if (error instanceof AuthError) {
          clearSession();
          applySession(null);
        }
      }
    },
    [applySession]
  );

  // Restore on mount, then reconcile a possibly-stale stored admin flag.
  useEffect(() => {
    const restored = loadSession();
    applySession(restored);
    if (restored?.token) {
      void reconcileSession(restored.token);
    }
  }, [applySession, reconcileSession]);

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

  const authFetch = useCallback<typeof fetch>(
    async (input, init) => {
      const headers = new Headers(init?.headers);
      if (tokenRef.current) {
        headers.set("authorization", `Bearer ${tokenRef.current}`);
      }
      const response = await fetch(input, { ...init, headers });
      if (response.status === 401) {
        clearSession();
        applySession(null);
        // Surface as an auth error so callers abort instead of parsing a 401 body;
        // applySession(null) also redirects to /login via ProtectedRoute.
        throw new AuthError("Session expired");
      }
      if (response.status === 403 && tokenRef.current) {
        // A 403 may mean the live isAdmin no longer matches our stored flag (e.g.
        // just demoted). Reconcile against /me so the admin nav/route drops on the
        // next render. The caller still receives the 403 to handle as usual.
        void reconcileSession(tokenRef.current);
      }
      return response;
    },
    [applySession, reconcileSession]
  );

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
