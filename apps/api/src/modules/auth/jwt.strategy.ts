import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthenticatedUser } from "@slides-agent/domain";
import type { AuthConfig } from "@/config/auth.config";
import { AUTH_CONFIG } from "@/modules/auth/auth.tokens";
import { AuthService } from "@/modules/auth/auth.service";

interface JwtPayload {
  sub: string;
  exp: number;
  // NOTE: do NOT read `isAdmin` (or any role) from the token for authorization.
  // The signed claim is a stale UI hint only; `validate()` below re-reads the live
  // DB value so a demoted admin is rejected on the very next request (FR-017a/019).
}

/** Public user attached to the request, plus the token expiry for `/auth/me`. */
export type AuthedRequestUser = AuthenticatedUser & { expiresAt: string };

/**
 * passport-jwt strategy ("jwt") used to protect endpoints. Verifies the bearer
 * token signature + expiry (passport-jwt), then re-checks the account is still
 * active via AuthService (a valid signature for a disabled/removed account is
 * rejected).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    @Inject(AUTH_CONFIG) config: AuthConfig,
    @Inject(AuthService) private readonly authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
      // Pin the algorithm so HS384/HS512 (auto-inferred for HMAC secrets) and any
      // future alg-confusion are ruled out; verify the issuer we signed with.
      algorithms: ["HS256"],
      issuer: config.jwtIssuer
    });
  }

  async validate(payload: JwtPayload): Promise<AuthedRequestUser> {
    const user = await this.authService.validateSessionUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { ...user, expiresAt: new Date(payload.exp * 1000).toISOString() };
  }
}
