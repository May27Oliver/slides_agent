import { Controller, Get } from "@nestjs/common";

/**
 * Liveness probe (012). Public (no guard) and intentionally trivial: it proves
 * the HTTP server is up and accepting requests. It MUST NOT query Postgres or
 * Redis — readiness of those is gated by their own container healthchecks
 * (pg_isready / redis PING), not by this endpoint. Mounted at `/api/health`
 * via the global `api` prefix; used by the api container's Docker healthcheck.
 */
@Controller("health")
export class HealthController {
  @Get()
  check(): { status: "ok" } {
    return { status: "ok" };
  }
}
