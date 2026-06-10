import type { LoginResponseContract, MeResponseContract } from "@slides-agent/contracts";

export class AuthError extends Error {
  /** Public, sanitized server code (e.g. AUTH_INVALID / ACCOUNT_PENDING /
   * ACCOUNT_DISABLED), or AUTH_INVALID as a safe default. */
  readonly code: string;

  constructor(message = "Authentication failed", code = "AUTH_INVALID") {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export async function loginRequest(
  username: string,
  password: string,
  fetchImpl: typeof fetch = fetch
): Promise<LoginResponseContract> {
  const response = await fetchImpl("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!response.ok) {
    // Carry the server's code so the view can distinguish pending/disabled from a
    // generic credential failure (DR-002). Unknown account / wrong password stay
    // AUTH_INVALID — no enumeration.
    const code = await readErrorCode(response);
    throw new AuthError("Login failed", code);
  }
  return (await response.json()) as LoginResponseContract;
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { code?: string };
    return typeof body.code === "string" ? body.code : "AUTH_INVALID";
  } catch {
    return "AUTH_INVALID";
  }
}

/**
 * Re-reads the live session (`GET /api/auth/me`) for the given token. The server
 * re-validates against the DB, so the returned `user.isAdmin` is the CURRENT value
 * — used to reconcile a possibly-stale stored admin flag after a demotion
 * (FR-017a). Throws {@link AuthError} on a non-2xx (e.g. the account was disabled).
 */
export async function meRequest(
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<MeResponseContract> {
  const response = await fetchImpl("/api/auth/me", {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new AuthError("Session invalid", await readErrorCode(response));
  }
  return (await response.json()) as MeResponseContract;
}

export async function logoutRequest(
  token: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  try {
    await fetchImpl("/api/auth/logout", {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {}
    });
  } catch {
    // Stateless logout: ignore network errors; the client already cleared state.
  }
}
