import type { AccountStatus } from "@/auth/auth.types";

/** Fields needed to persist a newly created account (register or admin-seeded). */
export interface CreateAccountInput {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  status: AccountStatus;
  isAdmin: boolean;
}

/** Public-safe projection of an account for the admin dashboard. No password hash. */
export interface AdminAccountView {
  id: string;
  username: string;
  displayName: string;
  status: AccountStatus;
  isAdmin: boolean;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/**
 * Write/list capability boundary over the accounts store (DR-004). The read-only
 * {@link UserAccountStore} stays for the auth hot path; this adds the
 * registration + admin-management surface. `countActiveAdmins` counts only admins
 * whose status is 'active' (feeds the FR-018 anti-lockout guard).
 */
export interface AccountAdminStore {
  create(input: CreateAccountInput): Promise<AdminAccountView>;
  listAll(filter?: { status?: AccountStatus }): Promise<AdminAccountView[]>;
  /** Pre-mutation read (status/isAdmin/existence) without exposing the hash. */
  getById(id: string): Promise<AdminAccountView | undefined>;
  updateStatus(id: string, status: AccountStatus): Promise<AdminAccountView | undefined>;
  setAdmin(id: string, isAdmin: boolean): Promise<AdminAccountView | undefined>;
  /** Returns true if a row was deleted, false if no account had that id. */
  deleteById(id: string): Promise<boolean>;
  countActiveAdmins(): Promise<number>;
}
