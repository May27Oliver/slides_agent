import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import type { AuthenticatedUser } from "@slides-agent/domain";
import { validateLoginRequest } from "@slides-agent/contracts";
import { AuthService } from "@/modules/auth/auth.service";

/**
 * passport-local strategy ("local") used by the login endpoint. Validates the
 * username/password via AuthService and maps the domain failure code to the right
 * HTTP shape (DR-002, boundary code mapping — domain lowercase → public uppercase):
 *
 * - `invalid_credentials` (unknown user / wrong password) → generic 401 (the guard
 *   collapses it to `AUTH_INVALID`; no enumeration).
 * - `account_pending` / `account_disabled` (correct password, owner) →
 *   `ForbiddenException` with the public `ACCOUNT_PENDING` / `ACCOUNT_DISABLED`
 *   code; the guard preserves it so the owner sees a distinct, actionable 403.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, "local") {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {
    super({ usernameField: "username", passwordField: "password" });
  }

  async validate(username: string, password: string): Promise<AuthenticatedUser> {
    // Bound the inputs (esp. password length) before scrypt runs, so an
    // oversized password can't burn a CPU thread. Same caps as the FE contract.
    if (!validateLoginRequest({ username, password }).ok) {
      throw new UnauthorizedException();
    }
    const result = await this.authService.validateCredentials(username, password);
    if (result.ok) {
      return result.user;
    }
    if (result.code === "account_pending") {
      throw new ForbiddenException({
        code: "ACCOUNT_PENDING",
        message: "Your account is awaiting administrator approval."
      });
    }
    if (result.code === "account_disabled") {
      throw new ForbiddenException({
        code: "ACCOUNT_DISABLED",
        message: "Your account has been disabled."
      });
    }
    // invalid_credentials (and any other code) → generic 401 via the guard.
    throw new UnauthorizedException();
  }
}
