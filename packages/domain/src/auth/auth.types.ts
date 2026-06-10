/** Account lifecycle (feature 013). `pending` = self-registered, awaiting admin
 * approval; `active` = may log in; `disabled` = revoked. Replaces the old two-state
 * `active` boolean (No shim). */
export type AccountStatus = "pending" | "active" | "disabled";

/** An identity known to the service. Created by self-registration (→ `pending`)
 * or seeded from the env allowlist; an admin moves it through `status`. */
export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  /** Password verifier (e.g. scrypt). Never returned to the frontend. */
  passwordHash: string;
  status: AccountStatus;
  isAdmin: boolean;
}

/** Public-safe subset of a user, returned to the frontend / put in the JWT.
 * `isAdmin` here is for UI hints only; authorization re-reads the DB live value. */
export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
}

/** Internal failure classification. Public responses collapse `invalid_credentials`
 * to a generic message (no enumeration); `account_pending`/`account_disabled` are
 * only ever reached by someone holding the correct password (DR-002). */
export type AuthFailureCode =
  | "invalid_credentials"
  | "account_pending"
  | "account_disabled"
  | "expired_session"
  | "invalid_token"
  | "missing_token"
  | "unavailable";
