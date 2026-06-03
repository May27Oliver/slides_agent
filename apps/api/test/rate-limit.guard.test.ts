import { describe, expect, it } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { RateLimitGuard } from "../src/modules/preview-jobs/rate-limit.guard";

function contextFor(ip: string, headers: Record<string, string | string[] | undefined> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip, headers })
    })
  } as unknown as ExecutionContext;
}

describe("RateLimitGuard", () => {
  it("allows requests up to the limit then blocks with 429", () => {
    let now = 1_000;
    const guard = new RateLimitGuard({ windowMs: 1_000, max: 2, now: () => now });
    const ctx = contextFor("10.0.0.1");

    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrowError(/too many/iu);

    try {
      guard.canActivate(ctx);
    } catch (error) {
      expect((error as { getStatus(): number }).getStatus()).toBe(429);
      expect((error as { getResponse(): { code: string } }).getResponse().code).toBe(
        "RATE_LIMITED"
      );
    }
  });

  it("permits requests again once the window has passed", () => {
    let now = 1_000;
    const guard = new RateLimitGuard({ windowMs: 1_000, max: 1, now: () => now });
    const ctx = contextFor("10.0.0.2");

    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrow();

    now += 1_001;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("ignores x-forwarded-for so it cannot be spoofed to bypass the per-ip limit", () => {
    const guard = new RateLimitGuard({ windowMs: 10_000, max: 1, now: () => 1_000 });

    expect(guard.canActivate(contextFor("10.0.0.3"))).toBe(true);
    // Same socket IP with a spoofed XFF must NOT get a fresh budget.
    expect(() =>
      guard.canActivate(contextFor("10.0.0.3", { "x-forwarded-for": "203.0.113.9" }))
    ).toThrow();
  });

  it("tracks distinct client IPs independently", () => {
    const guard = new RateLimitGuard({ windowMs: 10_000, max: 1, now: () => 1_000 });

    expect(guard.canActivate(contextFor("10.0.0.4"))).toBe(true);
    expect(guard.canActivate(contextFor("10.0.0.5"))).toBe(true);
  });
});
