import { describe, expect, it } from "vitest";
import { evaluateAdminMutation } from "@/auth/admin-mutation.policy";

/**
 * FR-018 anti-lockout policy (DR-006). A mutation that would strip the LAST active
 * admin of its management ability (demote or disable) is refused, as is any
 * attempt to disable/demote oneself. `activeAdminCount` counts only admins whose
 * status is 'active' (computed by the caller via countActiveAdmins).
 */
describe("evaluateAdminMutation", () => {
  it("allows promoting another user to admin", () => {
    expect(
      evaluateAdminMutation({
        actorId: "admin_a",
        targetId: "user_b",
        activeAdminCount: 1,
        change: { type: "setAdmin", isAdmin: true }
      })
    ).toEqual({ ok: true });
  });

  it("allows disabling a non-admin user even when only one admin remains", () => {
    expect(
      evaluateAdminMutation({
        actorId: "admin_a",
        targetId: "user_b",
        activeAdminCount: 1,
        change: { type: "setStatus", status: "disabled", targetIsActiveAdmin: false }
      })
    ).toEqual({ ok: true });
  });

  it("refuses demoting the last active admin (LAST_ADMIN_PROTECTED)", () => {
    expect(
      evaluateAdminMutation({
        actorId: "admin_a",
        targetId: "admin_b",
        activeAdminCount: 1,
        change: { type: "setAdmin", isAdmin: false, targetIsActiveAdmin: true }
      })
    ).toEqual({ ok: false, code: "LAST_ADMIN_PROTECTED" });
  });

  it("refuses disabling the last active admin (LAST_ADMIN_PROTECTED)", () => {
    expect(
      evaluateAdminMutation({
        actorId: "admin_a",
        targetId: "admin_b",
        activeAdminCount: 1,
        change: { type: "setStatus", status: "disabled", targetIsActiveAdmin: true }
      })
    ).toEqual({ ok: false, code: "LAST_ADMIN_PROTECTED" });
  });

  it("allows demoting an admin when other active admins remain", () => {
    expect(
      evaluateAdminMutation({
        actorId: "admin_a",
        targetId: "admin_b",
        activeAdminCount: 2,
        change: { type: "setAdmin", isAdmin: false, targetIsActiveAdmin: true }
      })
    ).toEqual({ ok: true });
  });

  it("refuses demoting yourself (CANNOT_MODIFY_SELF)", () => {
    expect(
      evaluateAdminMutation({
        actorId: "admin_a",
        targetId: "admin_a",
        activeAdminCount: 3,
        change: { type: "setAdmin", isAdmin: false, targetIsActiveAdmin: true }
      })
    ).toEqual({ ok: false, code: "CANNOT_MODIFY_SELF" });
  });

  it("refuses disabling yourself (CANNOT_MODIFY_SELF)", () => {
    expect(
      evaluateAdminMutation({
        actorId: "admin_a",
        targetId: "admin_a",
        activeAdminCount: 3,
        change: { type: "setStatus", status: "disabled", targetIsActiveAdmin: true }
      })
    ).toEqual({ ok: false, code: "CANNOT_MODIFY_SELF" });
  });

  it("allows re-enabling yourself (status -> active is never a lockout)", () => {
    expect(
      evaluateAdminMutation({
        actorId: "admin_a",
        targetId: "admin_a",
        activeAdminCount: 1,
        change: { type: "setStatus", status: "active", targetIsActiveAdmin: true }
      })
    ).toEqual({ ok: true });
  });
});
