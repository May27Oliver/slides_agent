export interface LoginRequestContract {
  username: string;
  password: string;
}

export interface AuthUserContract {
  id: string;
  username: string;
  displayName: string;
}

export interface LoginResponseContract {
  token: string;
  expiresAt: string;
  user: AuthUserContract;
}

export interface MeResponseContract {
  authenticated: true;
  expiresAt: string;
  user: AuthUserContract;
}

/** Sanitized auth error shape. `AUTH_INVALID` = login failed; `AUTH_REQUIRED` = not authenticated. */
export interface AuthErrorContract {
  code: "AUTH_INVALID" | "AUTH_REQUIRED";
  message: string;
}

export interface LoginRequestError {
  code: "INVALID_INPUT";
  message: string;
  fields: string[];
}

export type LoginRequestValidationResult =
  | { ok: true; value: LoginRequestContract }
  | { ok: false; error: LoginRequestError };

const MAX_USERNAME_CHARS = 320;
const MAX_PASSWORD_CHARS = 1_000;

export function validateLoginRequest(input: unknown): LoginRequestValidationResult {
  if (!isRecord(input)) {
    return invalid(["username", "password"]);
  }

  const username = typeof input.username === "string" ? input.username : "";
  const password = typeof input.password === "string" ? input.password : "";

  const missing = [
    username.trim() ? undefined : "username",
    password ? undefined : "password"
  ].filter((field): field is string => Boolean(field));

  if (missing.length > 0) {
    return invalid(missing);
  }

  if (username.length > MAX_USERNAME_CHARS || password.length > MAX_PASSWORD_CHARS) {
    return invalid(username.length > MAX_USERNAME_CHARS ? ["username"] : ["password"]);
  }

  return { ok: true, value: { username, password } };
}

function invalid(fields: string[]): LoginRequestValidationResult {
  return {
    ok: false,
    error: { code: "INVALID_INPUT", message: "username and password are required", fields }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
