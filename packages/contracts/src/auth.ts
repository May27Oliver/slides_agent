export interface LoginRequestContract {
  username: string;
  password: string;
}

export interface AuthUserContract {
  id: string;
  username: string;
  displayName: string;
  /** UI hint only — server authorization re-reads the live DB value. */
  isAdmin: boolean;
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

/** Account lifecycle exposed to the frontend (mirrors domain AccountStatus). */
export type AccountStatusContract = "pending" | "active" | "disabled";

/** Public-safe account view: register response + admin dashboard rows. No hash. */
export interface PublicAccount {
  id: string;
  username: string;
  displayName: string;
  status: AccountStatusContract;
  isAdmin: boolean;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** Registration always lands in `pending`; no token is issued (FR-013a). */
export type RegisterResponseContract = PublicAccount;

/**
 * Sanitized auth error shape.
 * - `AUTH_INVALID` = login failed (generic; never reveals account existence).
 * - `AUTH_REQUIRED` = not authenticated.
 * - `ACCOUNT_PENDING` / `ACCOUNT_DISABLED` = correct password, but the account is
 *   not yet approved / has been disabled (only reachable by the account owner).
 * - `REGISTRATION_DISABLED` = self-registration is turned off.
 */
export interface AuthErrorContract {
  code:
    | "AUTH_INVALID"
    | "AUTH_REQUIRED"
    | "ACCOUNT_PENDING"
    | "ACCOUNT_DISABLED"
    | "REGISTRATION_DISABLED";
  message: string;
}

/** Public registration availability flag (DR-010, GET /api/auth/config). */
export interface AuthConfigContract {
  registrationEnabled: boolean;
}

export interface RegisterRequestContract {
  username: string;
  displayName: string;
  password: string;
}

/** Admin dashboard list response. */
export interface AdminUserListResponse {
  users: PublicAccount[];
}

/** Admin mutation request: at least one of status/isAdmin. */
export interface AdminUpdateUserRequest {
  status?: AccountStatusContract;
  isAdmin?: boolean;
}

/** Admin guardrail error (FR-018) + not-found / bad-target shapes. */
export interface AdminMutationErrorContract {
  code:
    | "LAST_ADMIN_PROTECTED"
    | "CANNOT_MODIFY_SELF"
    | "CANNOT_REJECT_NON_PENDING"
    | "USER_NOT_FOUND"
    | "INVALID_INPUT";
  message: string;
}

export interface RequestValidationError {
  code: "INVALID_INPUT";
  message: string;
  fields: string[];
}

export type LoginRequestError = RequestValidationError;

export type LoginRequestValidationResult =
  | { ok: true; value: LoginRequestContract }
  | { ok: false; error: RequestValidationError };

export type RegisterRequestValidationResult =
  | { ok: true; value: RegisterRequestContract }
  | { ok: false; error: RequestValidationError };

const MAX_USERNAME_CHARS = 320;
const MAX_DISPLAY_NAME_CHARS = 200;
const MAX_PASSWORD_CHARS = 1_000;
const MIN_PASSWORD_CHARS = 10;
// Pragmatic email shape: one @, no spaces, a dotted domain. Not RFC-perfect by
// design — we only reject obviously malformed addresses, not exotic-but-valid ones.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

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
    const field = username.length > MAX_USERNAME_CHARS ? "username" : "password";
    return invalid([field], `${field} exceeds the maximum allowed length`);
  }

  return { ok: true, value: { username, password } };
}

/**
 * Registration validation (DR-008). email-shaped username, required display name,
 * and a password of at least {@link MIN_PASSWORD_CHARS} chars containing at least
 * one letter and one digit. Username is trimmed; the password is preserved
 * verbatim (leading/trailing spaces are legal password characters).
 */
export function validateRegisterRequest(input: unknown): RegisterRequestValidationResult {
  if (!isRecord(input)) {
    return registerInvalid(["username", "displayName", "password"]);
  }

  const username = (typeof input.username === "string" ? input.username : "").trim();
  const displayName = (typeof input.displayName === "string" ? input.displayName : "").trim();
  const password = typeof input.password === "string" ? input.password : "";

  const fields: string[] = [];
  if (!username || username.length > MAX_USERNAME_CHARS || !EMAIL_PATTERN.test(username)) {
    fields.push("username");
  }
  if (!displayName || displayName.length > MAX_DISPLAY_NAME_CHARS) {
    fields.push("displayName");
  }
  if (!isAcceptablePassword(password)) {
    fields.push("password");
  }

  if (fields.length > 0) {
    return registerInvalid(fields);
  }

  return { ok: true, value: { username, displayName, password } };
}

function isAcceptablePassword(password: string): boolean {
  return (
    password.length >= MIN_PASSWORD_CHARS &&
    password.length <= MAX_PASSWORD_CHARS &&
    /[A-Za-z]/u.test(password) &&
    /\d/u.test(password)
  );
}

function invalid(
  fields: string[],
  message = "username and password are required"
): LoginRequestValidationResult {
  return {
    ok: false,
    error: { code: "INVALID_INPUT", message, fields }
  };
}

function registerInvalid(fields: string[]): RegisterRequestValidationResult {
  return {
    ok: false,
    error: {
      code: "INVALID_INPUT",
      message:
        "A valid email, a display name, and a password (min 10 chars, with a letter and a digit) are required.",
      fields
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
