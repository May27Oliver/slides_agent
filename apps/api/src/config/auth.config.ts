import type { UserAccount } from "@slides-agent/domain";

/**
 * Backend-only auth configuration. `AUTH_JWT_SECRET` is required — the API fails
 * fast on startup without it. Accounts come from the `AUTH_ACCOUNTS` JSON
 * allowlist (passwordHash produced by `pnpm auth:hash`).
 */
export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  accounts: UserAccount[];
  loginRateLimit: { max: number; windowMs: number };
}

type EnvLike = Record<string, string | undefined>;

const DEFAULT_EXPIRES_IN = "30d";
const DEFAULT_LOGIN_RATE_LIMIT_MAX = 10;
const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;

export function loadAuthConfig(env: EnvLike = process.env): AuthConfig {
  const jwtSecret = env.AUTH_JWT_SECRET?.trim();
  if (!jwtSecret) {
    throw new Error("AUTH_JWT_SECRET is required but is not configured.");
  }

  return {
    jwtSecret,
    jwtExpiresIn: env.AUTH_JWT_EXPIRES_IN?.trim() || DEFAULT_EXPIRES_IN,
    accounts: parseAccounts(env.AUTH_ACCOUNTS),
    loginRateLimit: {
      max: positiveIntOr(env.AUTH_LOGIN_RATE_LIMIT_MAX, DEFAULT_LOGIN_RATE_LIMIT_MAX),
      windowMs: positiveIntOr(env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS, DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS)
    }
  };
}

function parseAccounts(raw: string | undefined): UserAccount[] {
  if (!raw || !raw.trim()) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AUTH_ACCOUNTS must be valid JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("AUTH_ACCOUNTS must be a JSON array.");
  }
  return parsed.map(toUserAccount);
}

function toUserAccount(value: unknown, index: number): UserAccount {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.username !== "string" ||
    typeof value.displayName !== "string" ||
    typeof value.passwordHash !== "string" ||
    typeof value.active !== "boolean"
  ) {
    throw new Error(`AUTH_ACCOUNTS[${index}] is malformed.`);
  }
  return {
    id: value.id,
    username: value.username,
    displayName: value.displayName,
    passwordHash: value.passwordHash,
    active: value.active
  };
}

function positiveIntOr(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
