import { Inject, Injectable } from "@nestjs/common";
import { RateLimitGuard } from "@/common/rate-limit.guard";
import type { AuthConfig } from "@/config/auth.config";
import { AUTH_CONFIG } from "@/modules/auth/auth.tokens";

/**
 * Per-IP throttle for the public registration endpoint (FR-011 / T023),
 * configured from the validated AuthConfig via DI. A 429 reveals nothing about
 * account existence. Separate from the login limiter so the two can be tuned and
 * counted independently.
 */
@Injectable()
export class RegisterRateLimitGuard extends RateLimitGuard {
  constructor(@Inject(AUTH_CONFIG) config: AuthConfig) {
    super({
      windowMs: config.registerRateLimit.windowMs,
      max: config.registerRateLimit.max,
      message: "Too many registration attempts. Please wait a moment and try again."
    });
  }
}
