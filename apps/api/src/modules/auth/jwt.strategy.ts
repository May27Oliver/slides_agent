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
      secretOrKey: config.jwtSecret
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
