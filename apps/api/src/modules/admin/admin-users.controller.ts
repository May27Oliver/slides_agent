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
import type { AccountAdminStore, AccountStatus } from "@slides-agent/domain";
import type {
  AdminSettableStatus,
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

    // The store applies the change and the FR-018 anti-lockout guard atomically
    // (count + write in one transaction), so demote/disable can't be raced.
    const outcome = await this.accounts.applyAdminMutation({
      actorId: request.user.id,
      targetId: id,
      status,
      isAdmin
    });
    if (outcome.status === "not_found") {
      throw new NotFoundException({ code: "ACCOUNT_NOT_FOUND", message: "Account not found." });
    }
    if (outcome.status === "lockout") {
      throw new ConflictException({ code: outcome.code, message: lockoutMessage(outcome.code) });
    }
    return outcome.account;
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    const target = await this.accounts.getById(id);
    if (!target) {
      throw new NotFoundException({ code: "ACCOUNT_NOT_FOUND", message: "Account not found." });
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
  // FR-010: an admin may only SET 'active' or 'disabled'. Reject 'pending' (and any
  // other value) — allowing it would let an admin park the last active admin in a
  // non-loginable state, bypassing the FR-018 lockout guard.
  if (status !== undefined && !isSettableStatus(status)) {
    throw new BadRequestException({
      code: "INVALID_INPUT",
      message: "status must be 'active' or 'disabled'."
    });
  }
  if (isAdmin !== undefined && typeof isAdmin !== "boolean") {
    throw new BadRequestException({ code: "INVALID_INPUT", message: "isAdmin must be a boolean." });
  }
  return { status, isAdmin };
}

function isStatus(value: string): value is AccountStatus {
  return (STATUSES as string[]).includes(value);
}

function isSettableStatus(value: string): value is AdminSettableStatus {
  return value === "active" || value === "disabled";
}

function lockoutMessage(code: "LAST_ADMIN_PROTECTED" | "CANNOT_MODIFY_SELF"): string {
  return code === "LAST_ADMIN_PROTECTED"
    ? "Cannot remove the last active administrator."
    : "You cannot disable or demote your own account.";
}
