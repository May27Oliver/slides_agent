import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable
} from "@nestjs/common";

export interface RateLimitGuardOptions {
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per client within the window. */
  max: number;
  /** Context-appropriate 429 message (defaults to a generic one). */
  message?: string;
  /** Clock injection point for tests. */
  now?: () => number;
}

const DEFAULT_RATE_LIMIT_MESSAGE = "Too many requests. Please wait a moment and try again.";

interface RateLimitedRequest {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

/**
 * Dependency-free, in-process per-client sliding-window rate limiter.
 *
 * Matches the app's single-instance, in-memory architecture (no Redis / no
 * @nestjs/throttler dependency). Intended for the expensive POST endpoints that
 * fan out into chained LLM calls; the cheap polling GET is left unthrottled.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windowMs: number;
  private readonly max: number;
  private readonly message: string;
  private readonly now: () => number;
  private readonly hits = new Map<string, number[]>();
  private lastSweepAt = 0;

  constructor(options: RateLimitGuardOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.message = options.message ?? DEFAULT_RATE_LIMIT_MESSAGE;
    this.now = options.now ?? (() => Date.now());
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RateLimitedRequest>();
    const key = clientKey(request);
    const now = this.now();
    const windowStart = now - this.windowMs;

    this.maybeSweep(now, windowStart);

    const recent = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

    if (recent.length >= this.max) {
      throw new HttpException(
        { code: "RATE_LIMITED", message: this.message },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  // Drop keys whose timestamps have all aged out, so the map stays bounded by the
  // number of clients active within the window (not by total clients ever seen).
  private maybeSweep(now: number, windowStart: number): void {
    if (now - this.lastSweepAt < this.windowMs) {
      return;
    }
    this.lastSweepAt = now;
    for (const [key, timestamps] of this.hits) {
      if (timestamps.every((timestamp) => timestamp <= windowStart)) {
        this.hits.delete(key);
      }
    }
  }
}

/**
 * Client identity for rate limiting. Uses the framework-populated `req.ip`
 * (and socket fallback) — NOT a raw `X-Forwarded-For`, which any caller can
 * spoof to mint unlimited keys. If deployed behind a trusted reverse proxy,
 * enable Express `trust proxy` so `req.ip` reflects the real client.
 */
function clientKey(request: RateLimitedRequest): string {
  return (request.ip || request.socket?.remoteAddress || "unknown").trim() || "unknown";
}
