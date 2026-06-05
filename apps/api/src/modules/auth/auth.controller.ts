import { Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, UseGuards } from "@nestjs/common";
import type { LoginResponseContract, MeResponseContract } from "@slides-agent/contracts";
import { RateLimitGuard } from "@/common/rate-limit.guard";
import { AuthService } from "@/modules/auth/auth.service";
import { LocalAuthGuard } from "@/modules/auth/local-auth.guard";
import { JwtAuthGuard } from "@/modules/auth/jwt-auth.guard";
import type { AuthedRequestUser } from "@/modules/auth/jwt.strategy";

// Per-IP throttle on the login endpoint (FR-011). Tunable via env; defaults to
// 10 req/60s/IP. Sanitized: a 429 reveals nothing about account existence.
const loginRateLimit = new RateLimitGuard({
  windowMs: Number(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX) || 10
});

interface AuthedRequest {
  user: AuthedRequestUser;
}

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("login")
  @UseGuards(loginRateLimit, LocalAuthGuard)
  async login(@Req() request: AuthedRequest): Promise<LoginResponseContract> {
    // LocalAuthGuard has validated credentials and attached the user.
    return this.authService.issueSession(request.user);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthedRequest): MeResponseContract {
    const { expiresAt, ...user } = request.user;
    return { authenticated: true, expiresAt, user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(): void {
    // Stateless: the frontend clears its localStorage token. No server session
    // to revoke (token expiry + per-request account check enforce validity).
  }
}
