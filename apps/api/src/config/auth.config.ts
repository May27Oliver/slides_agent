import type { BootstrapAccount } from "@slides-agent/domain";

/**
 * Backend-only auth configuration. `AUTH_JWT_SECRET` is required — the API fails
 * fast on startup without it. Accounts come from the `AUTH_ACCOUNTS` JSON
 * allowlist (passwordHash produced by `pnpm auth:hash`). Entries are
 * {@link BootstrapAccount}s: the two-state `active` boolean is a bootstrap input
 * that `seedAccounts` maps onto the DB `status` on first insert (DR-007).
 */
export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtIssuer: string;
  accounts: BootstrapAccount[];
  loginRateLimit: { max: number; windowMs: number };
}

type EnvLike = Record<string, string | undefined>;

const DEFAULT_EXPIRES_IN = "30d";
const DEFAULT_ISSUER = "slides-agent";
const MIN_JWT_SECRET_CHARS = 32;
const DEFAULT_LOGIN_RATE_LIMIT_MAX = 10;
const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;
// Accepts a bare seconds count or a vercel/ms duration string (e.g. "30d", "12h").
const EXPIRES_IN_PATTERN = /^\d+(\.\d+)?\s*(ms|s|m|h|d|w|y)?$/u;

export function loadAuthConfig(env: EnvLike = process.env): AuthConfig {
  const jwtSecret = env.AUTH_JWT_SECRET?.trim();
  if (!jwtSecret) {
    throw new Error("AUTH_JWT_SECRET is required but is not configured.");
  }
  if (jwtSecret.length < MIN_JWT_SECRET_CHARS) {
    throw new Error(`AUTH_JWT_SECRET must be at least ${MIN_JWT_SECRET_CHARS} characters.`);
  }

  const jwtExpiresIn = env.AUTH_JWT_EXPIRES_IN?.trim() || DEFAULT_EXPIRES_IN;
  if (!EXPIRES_IN_PATTERN.test(jwtExpiresIn)) {
    throw new Error('AUTH_JWT_EXPIRES_IN must be a seconds count or a duration string like "30d".');
  }

  return {
    jwtSecret,
    jwtExpiresIn,
    jwtIssuer: env.AUTH_JWT_ISSUER?.trim() || DEFAULT_ISSUER,
    accounts: parseAccounts(env.AUTH_ACCOUNTS),
    loginRateLimit: {
      max: positiveIntOr(env.AUTH_LOGIN_RATE_LIMIT_MAX, DEFAULT_LOGIN_RATE_LIMIT_MAX),
      windowMs: positiveIntOr(
        env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
        DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS
      )
    }
  };
}

/**
 * Parses only the AUTH_ACCOUNTS allowlist — used by `db:seed`, which must not
 * require AUTH_JWT_SECRET (seeding accounts has nothing to do with JWT signing).
 */
export function loadSeedAccounts(env: EnvLike = process.env): BootstrapAccount[] {
  return parseAccounts(env.AUTH_ACCOUNTS);
}

function parseAccounts(raw: string | undefined): BootstrapAccount[] {
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
  return parsed.map(toBootstrapAccount);
}

function toBootstrapAccount(value: unknown, index: number): BootstrapAccount {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.username !== "string" ||
    typeof value.displayName !== "string" ||
    typeof value.passwordHash !== "string" ||
    typeof value.active !== "boolean" ||
    (value.isAdmin !== undefined && typeof value.isAdmin !== "boolean")
  ) {
    throw new Error(`AUTH_ACCOUNTS[${index}] is malformed.`);
  }
  return {
    id: value.id,
    username: value.username,
    displayName: value.displayName,
    passwordHash: value.passwordHash,
    active: value.active,
    // Only carry isAdmin when explicitly provided (keeps the bootstrap value clean).
    ...(value.isAdmin === undefined ? {} : { isAdmin: value.isAdmin })
  };
}

function positiveIntOr(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
