import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Guard for the login endpoint. Any failure (unknown user, wrong password,
 * inactive account, missing/malformed credentials) yields one identical
 * sanitized 401 — never reveals whether an account exists.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {
  handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException({ code: "AUTH_INVALID", message: "Login failed." });
    }
    return user;
  }
}
