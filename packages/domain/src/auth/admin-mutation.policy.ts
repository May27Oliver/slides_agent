import type { AccountStatus } from "@/auth/auth.types";

/** A pending admin action against one target account. `targetIsActiveAdmin` says
 * whether the target is currently an admin whose status is 'active' (only such a
 * target counts toward the last-admin lockout guard). */
export type AdminChange =
  | { type: "setAdmin"; isAdmin: boolean; targetIsActiveAdmin?: boolean }
  | { type: "setStatus"; status: AccountStatus; targetIsActiveAdmin?: boolean };

export interface AdminMutationInput {
  actorId: string;
  targetId: string;
  /** Count of admins whose status is 'active' (caller computes via countActiveAdmins). */
  activeAdminCount: number;
  change: AdminChange;
}

export type AdminMutationDecision =
  | { ok: true }
  | { ok: false; code: "LAST_ADMIN_PROTECTED" | "CANNOT_MODIFY_SELF" };

/** Does this change remove an account's ability to manage (demote or disable)? */
function stripsManagement(change: AdminChange): boolean {
  return (
    (change.type === "setAdmin" && change.isAdmin === false) ||
    (change.type === "setStatus" && change.status === "disabled")
  );
}

/**
 * FR-018 anti-lockout policy (DR-006). Pure decision: refuses a mutation that
 * would demote/disable yourself, or that would strip the last active admin of its
 * management ability. Promotions and re-activations are always allowed.
 */
export function evaluateAdminMutation(input: AdminMutationInput): AdminMutationDecision {
  const { actorId, targetId, activeAdminCount, change } = input;

  if (!stripsManagement(change)) {
    return { ok: true };
  }

  // Self-protection takes precedence over the last-admin guard.
  if (targetId === actorId) {
    return { ok: false, code: "CANNOT_MODIFY_SELF" };
  }

  if (change.targetIsActiveAdmin && activeAdminCount <= 1) {
    return { ok: false, code: "LAST_ADMIN_PROTECTED" };
  }

  return { ok: true };
}
