/**
 * Shape of an entry in the `AUTH_ACCOUNTS` env allowlist (DR-007). Deliberately
 * keeps the two-state `active` boolean as a bootstrap INPUT (so the existing .env
 * format is unchanged); `seedAccounts` maps it to the DB `status` on first insert.
 * This is separate from the domain {@link UserAccount}, which has no `active`.
 */
export interface BootstrapAccount {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  active: boolean;
  isAdmin?: boolean;
}
