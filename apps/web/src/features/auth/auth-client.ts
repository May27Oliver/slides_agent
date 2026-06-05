import type { LoginResponseContract } from "@slides-agent/contracts";

export class AuthError extends Error {
  constructor(message = "Authentication failed") {
    super(message);
    this.name = "AuthError";
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
    throw new AuthError("Login failed");
  }
  return (await response.json()) as LoginResponseContract;
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
