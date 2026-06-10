import type { AuthenticatedUser, AuthFailureCode, UserAccount } from "@/auth/auth.types";

export type AuthEvaluation =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; code: AuthFailureCode };

/** Maps a non-active status to its failure code. */
function statusFailureCode(account: UserAccount): "account_pending" | "account_disabled" {
  return account.status === "pending" ? "account_pending" : "account_disabled";
}

/**
 * Pure login decision. Password matching (scrypt) happens in the adapter layer
 * and is passed in as `passwordMatches`, so this stays I/O-free and testable.
 *
 * Order matters (DR-002, anti-enumeration): unknown account and wrong password
 * both collapse to `invalid_credentials` BEFORE status is inspected, so a
 * pending/disabled account with a wrong password is indistinguishable from any
 * other failure. The `account_pending`/`account_disabled` codes are only returned
 * to a caller who already proved knowledge of the password (the account owner).
 */
export function evaluateLogin(
  account: UserAccount | undefined,
  passwordMatches: boolean
): AuthEvaluation {
  if (!account) {
    return { ok: false, code: "invalid_credentials" };
  }
  if (!passwordMatches) {
    return { ok: false, code: "invalid_credentials" };
  }
  if (account.status !== "active") {
    return { ok: false, code: statusFailureCode(account) };
  }
  return { ok: true, user: toAuthenticatedUser(account) };
}

/** Pure session decision for a token whose subject resolved to `account`. */
export function evaluateSession(account: UserAccount | undefined): AuthEvaluation {
  if (!account) {
    return { ok: false, code: "invalid_token" };
  }
  if (account.status !== "active") {
    return { ok: false, code: statusFailureCode(account) };
  }
  return { ok: true, user: toAuthenticatedUser(account) };
}

export function toAuthenticatedUser(account: UserAccount): AuthenticatedUser {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    isAdmin: account.isAdmin
  };
}
