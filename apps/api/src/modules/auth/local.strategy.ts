import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import type { AuthenticatedUser } from "@slides-agent/domain";
import { validateLoginRequest } from "@slides-agent/contracts";
import { AuthService } from "@/modules/auth/auth.service";

/**
 * passport-local strategy ("local") used by the login endpoint. Validates the
 * username/password from the request body via AuthService; throws on failure so
 * LocalAuthGuard can return a sanitized 401.
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
    const user = await this.authService.validateCredentials(username, password);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
