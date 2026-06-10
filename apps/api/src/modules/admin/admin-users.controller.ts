import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  evaluateAdminMutation,
  type AccountAdminStore,
  type AccountStatus,
  type AdminAccountView,
  type AdminMutationDecision
} from "@slides-agent/domain";
import type {
  AdminUpdateUserRequest,
  AdminUserListResponse,
  PublicAccount
} from "@slides-agent/contracts";
import { ACCOUNT_ADMIN_STORE } from "@/modules/auth/auth.tokens";
import { JwtAuthGuard } from "@/modules/auth/jwt-auth.guard";
import { AdminGuard } from "@/modules/admin/admin.guard";

const STATUSES: AccountStatus[] = ["pending", "active", "disabled"];

interface AdminRequest {
  user: { id: string };
}

/**
 * Admin user-management dashboard API (US2, DR-005). Protected by JwtAuthGuard +
 * AdminGuard (the latter reads the live `req.user.isAdmin`). All mutations are
 * idempotent; demote/disable run through the pure {@link evaluateAdminMutation}
 * anti-lockout policy (FR-018) before touching the DB.
 */
@Controller("admin/users")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(@Inject(ACCOUNT_ADMIN_STORE) private readonly accounts: AccountAdminStore) {}

  @Get()
  async list(@Query("status") status?: string): Promise<AdminUserListResponse> {
    if (status !== undefined && status !== "all" && !isStatus(status)) {
      throw new BadRequestException({ code: "INVALID_INPUT", message: "Unknown status filter." });
    }
    const filter = status && status !== "all" ? { status } : undefined;
    return { users: await this.accounts.listAll(filter) };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: AdminUpdateUserRequest,
    @Req() request: AdminRequest
  ): Promise<PublicAccount> {
    const { status, isAdmin } = parseUpdate(body);

    const target = await this.accounts.getById(id);
    if (!target) {
      throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found." });
    }

    await this.guardAgainstLockout({ actorId: request.user.id, target, status, isAdmin });

    let updated: AdminAccountView | undefined = target;
    if (status !== undefined) {
      updated = await this.accounts.updateStatus(id, status);
    }
    if (isAdmin !== undefined) {
      updated = await this.accounts.setAdmin(id, isAdmin);
    }
    if (!updated) {
      // Concurrent delete between getById and the write.
      throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found." });
    }
    return updated;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    const target = await this.accounts.getById(id);
    if (!target) {
      throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found." });
    }
    // DELETE is "reject a registration" — only ever valid for a pending account.
    if (target.status !== "pending") {
      throw new ConflictException({
        code: "CANNOT_REJECT_NON_PENDING",
        message: "Only a pending account can be deleted."
      });
    }
    await this.accounts.deleteById(id);
  }

  /** Runs the FR-018 policy for any demote/disable in this request. */
  private async guardAgainstLockout(input: {
    actorId: string;
    target: AdminAccountView;
    status?: AccountStatus | undefined;
    isAdmin?: boolean | undefined;
  }): Promise<void> {
    const { actorId, target, status, isAdmin } = input;
    const demotes = isAdmin === false;
    const disables = status === "disabled";
    if (!demotes && !disables) {
      return;
    }

    const targetIsActiveAdmin = target.isAdmin && target.status === "active";
    const activeAdminCount = await this.accounts.countActiveAdmins();

    const decisions: AdminMutationDecision[] = [];
    if (demotes) {
      decisions.push(
        evaluateAdminMutation({
          actorId,
          targetId: target.id,
          activeAdminCount,
          change: { type: "setAdmin", isAdmin: false, targetIsActiveAdmin }
        })
      );
    }
    if (disables) {
      decisions.push(
        evaluateAdminMutation({
          actorId,
          targetId: target.id,
          activeAdminCount,
          change: { type: "setStatus", status: "disabled", targetIsActiveAdmin }
        })
      );
    }

    for (const decision of decisions) {
      if (!decision.ok) {
        throw new ConflictException({
          code: decision.code,
          message: lockoutMessage(decision.code)
        });
      }
    }
  }
}

function parseUpdate(body: AdminUpdateUserRequest): {
  status?: AccountStatus | undefined;
  isAdmin?: boolean | undefined;
} {
  const status = body?.status;
  const isAdmin = body?.isAdmin;
  if (status === undefined && isAdmin === undefined) {
    throw new BadRequestException({
      code: "INVALID_INPUT",
      message: "Provide at least one of status or isAdmin."
    });
  }
  if (status !== undefined && !isStatus(status)) {
    throw new BadRequestException({ code: "INVALID_INPUT", message: "Unknown status." });
  }
  if (isAdmin !== undefined && typeof isAdmin !== "boolean") {
    throw new BadRequestException({ code: "INVALID_INPUT", message: "isAdmin must be a boolean." });
  }
  return { status, isAdmin };
}

function isStatus(value: string): value is AccountStatus {
  return (STATUSES as string[]).includes(value);
}

function lockoutMessage(code: "LAST_ADMIN_PROTECTED" | "CANNOT_MODIFY_SELF"): string {
  return code === "LAST_ADMIN_PROTECTED"
    ? "Cannot remove the last active administrator."
    : "You cannot disable or demote your own account.";
}
