import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Guard for the login endpoint. An unknown user, wrong password, or malformed
 * credentials all yield one identical sanitized 401 `AUTH_INVALID` — never reveals
 * whether an account exists.
 *
 * Exception (DR-002): a `ForbiddenException` raised by LocalStrategy means the
 * caller proved the password but the account is pending/disabled — that 403 (with
 * its `ACCOUNT_PENDING` / `ACCOUNT_DISABLED` code) is preserved so the owner gets
 * an actionable message. This is safe because it is only ever reached by someone
 * already holding the correct password.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {
  handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err instanceof ForbiddenException) {
      throw err;
    }
    if (err || !user) {
      throw new UnauthorizedException({ code: "AUTH_INVALID", message: "Login failed." });
    }
    return user;
  }
}
