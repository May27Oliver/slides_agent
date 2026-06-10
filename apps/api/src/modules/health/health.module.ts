import { Module } from "@nestjs/common";
import { HealthController } from "@/modules/health/health.controller";

/**
 * Provides the public liveness endpoint (`GET /api/health`) for the api
 * container's Docker healthcheck (012). No providers/guards — the controller is
 * stateless and intentionally does not touch DB/Redis.
 */
@Module({
  controllers: [HealthController]
})
export class HealthModule {}
