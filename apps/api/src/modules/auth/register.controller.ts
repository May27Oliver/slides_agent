import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards
} from "@nestjs/common";
import type { AccountAdminStore, UserAccountStore } from "@slides-agent/domain";
import { validateRegisterRequest, type RegisterResponseContract } from "@slides-agent/contracts";
import { hashPassword } from "@/common/scrypt-password";
import type { AuthConfig } from "@/config/auth.config";
import { ACCOUNT_ADMIN_STORE, AUTH_CONFIG, USER_ACCOUNT_STORE } from "@/modules/auth/auth.tokens";
import { RegisterRateLimitGuard } from "@/modules/auth/register-rate-limit.guard";

const PG_UNIQUE_VIOLATION = "23505";
const DUPLICATE_MESSAGE = "此 email 已被使用。";

/**
 * Public self-registration (US1, DR-005). Creates a `pending` account that cannot
 * log in until an admin approves it — no token is issued (FR-013a). Throttled
 * per-IP. When `REGISTRATION_ENABLED` is false the endpoint is closed (403).
 */
@Controller("auth")
export class RegisterController {
  constructor(
    @Inject(ACCOUNT_ADMIN_STORE) private readonly accounts: AccountAdminStore,
    @Inject(USER_ACCOUNT_STORE) private readonly lookup: UserAccountStore,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RegisterRateLimitGuard)
  async register(@Body() body: unknown): Promise<RegisterResponseContract> {
    if (!this.config.registrationEnabled) {
      throw new ForbiddenException({
        code: "REGISTRATION_DISABLED",
        message: "Self-registration is currently disabled."
      });
    }

    const parsed = validateRegisterRequest(body);
    if (!parsed.ok) {
      throw new BadRequestException(parsed.error);
    }
    const { username, displayName, password } = parsed.value;

    // Friendly pre-check; the DB unique index is the real guard (race backstop below).
    if (await this.lookup.findByUsername(username)) {
      throw new ConflictException({ code: "INVALID_INPUT", message: DUPLICATE_MESSAGE });
    }

    try {
      return await this.accounts.create({
        id: `user_${randomUUID()}`,
        username,
        displayName,
        passwordHash: hashPassword(password),
        status: "pending",
        isAdmin: false
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ code: "INVALID_INPUT", message: DUPLICATE_MESSAGE });
      }
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}
