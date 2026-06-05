import type { AuthUserContract } from "@slides-agent/contracts";

export interface StoredSession {
  token: string;
  expiresAt: string;
  user: AuthUserContract;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUserContract | null;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
  /** fetch wrapper that attaches the bearer token and clears the session on 401. */
  authFetch: typeof fetch;
}
