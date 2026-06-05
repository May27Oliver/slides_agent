import { Inject, Injectable } from "@nestjs/common";
import { RateLimitGuard } from "@/common/rate-limit.guard";
import type { AuthConfig } from "@/config/auth.config";
import { AUTH_CONFIG } from "@/modules/auth/auth.tokens";

/**
 * Per-IP throttle for the login endpoint (FR-011), configured from the validated
 * AuthConfig via DI (no direct process.env reads). A 429 reveals nothing about
 * account existence.
 */
@Injectable()
export class LoginRateLimitGuard extends RateLimitGuard {
  constructor(@Inject(AUTH_CONFIG) config: AuthConfig) {
    super({
      windowMs: config.loginRateLimit.windowMs,
      max: config.loginRateLimit.max,
      message: "Too many login attempts. Please wait a moment and try again."
    });
  }
}
