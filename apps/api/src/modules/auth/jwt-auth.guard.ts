import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Guard for protected endpoints. Missing/expired/invalid token, or a token for a
 * disabled/removed account, all yield one sanitized 401 `AUTH_REQUIRED`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException({ code: "AUTH_REQUIRED", message: "Login required." });
    }
    return user;
  }
}
