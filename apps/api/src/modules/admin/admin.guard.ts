import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";

interface MaybeAdminRequest {
  user?: { isAdmin?: boolean };
}

/**
 * Authorizes admin-only endpoints. Runs AFTER JwtAuthGuard, which attaches
 * `req.user` from a per-request DB read (jwt.strategy → validateSessionUser), so
 * `req.user.isAdmin` is the LIVE value — a demoted admin is rejected on the very
 * next request even though their JWT still claims admin (FR-017a / FR-019).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<MaybeAdminRequest>();
    if (request.user?.isAdmin === true) {
      return true;
    }
    throw new ForbiddenException({ code: "FORBIDDEN", message: "Administrator access required." });
  }
}
