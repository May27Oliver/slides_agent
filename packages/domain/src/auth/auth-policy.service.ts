import type { AuthenticatedUser, AuthFailureCode, UserAccount } from "@/auth/auth.types";

export type AuthEvaluation =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; code: AuthFailureCode };

/**
 * Pure login decision. Password matching (scrypt) happens in the adapter layer
 * and is passed in as `passwordMatches`, so this stays I/O-free and testable.
 * The failure `code` is internal classification; public responses must collapse
 * it to a generic message (do not reveal whether the account exists).
 */
export function evaluateLogin(
  account: UserAccount | undefined,
  passwordMatches: boolean
): AuthEvaluation {
  if (!account) {
    return { ok: false, code: "invalid_credentials" };
  }
  if (!account.active) {
    return { ok: false, code: "inactive_account" };
  }
  if (!passwordMatches) {
    return { ok: false, code: "invalid_credentials" };
  }
  return { ok: true, user: toAuthenticatedUser(account) };
}

/** Pure session decision for a token whose subject resolved to `account`. */
export function evaluateSession(account: UserAccount | undefined): AuthEvaluation {
  if (!account) {
    return { ok: false, code: "invalid_token" };
  }
  if (!account.active) {
    return { ok: false, code: "inactive_account" };
  }
  return { ok: true, user: toAuthenticatedUser(account) };
}

export function toAuthenticatedUser(account: UserAccount): AuthenticatedUser {
  return { id: account.id, username: account.username, displayName: account.displayName };
}
