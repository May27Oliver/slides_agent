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

/** A partial admin update: at least one of status/isAdmin, applied atomically. */
export interface AdminMutationRequest {
  /** The acting admin's id (for the self-modify guard, FR-018). */
  actorId: string;
  targetId: string;
  status?: AccountStatus | undefined;
  isAdmin?: boolean | undefined;
}

/**
 * Result of {@link AccountAdminStore.applyAdminMutation}. The anti-lockout refusal
 * and not-found are normal outcomes (not exceptions) so the caller maps them to
 * 409/404 without try/catch.
 */
export type AdminMutationOutcome =
  | { status: "ok"; account: AdminAccountView }
  | { status: "not_found" }
  | { status: "lockout"; code: "LAST_ADMIN_PROTECTED" | "CANNOT_MODIFY_SELF" };

/**
 * Write/list capability boundary over the accounts store (DR-004). The read-only
 * {@link UserAccountStore} stays for the auth hot path; this adds the
 * registration + admin-management surface.
 */
export interface AccountAdminStore {
  create(input: CreateAccountInput): Promise<AdminAccountView>;
  listAll(filter?: { status?: AccountStatus }): Promise<AdminAccountView[]>;
  /** Pre-mutation read (status/isAdmin/existence) without exposing the hash. */
  getById(id: string): Promise<AdminAccountView | undefined>;
  /**
   * Apply a status/isAdmin change while enforcing the FR-018 anti-lockout policy
   * against the active-admin count read INSIDE the same transaction. This closes
   * the TOCTOU that a separate count-then-write would leave (two admins demoting
   * each other could otherwise both pass a stale count and drop active admins to
   * zero). Returns the refusal/not-found outcome instead of writing.
   */
  applyAdminMutation(input: AdminMutationRequest): Promise<AdminMutationOutcome>;
  /** Returns true if a row was deleted, false if no account had that id. */
  deleteById(id: string): Promise<boolean>;
}
