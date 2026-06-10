import { Module } from "@nestjs/common";
import { PreviewJobsModule } from "@/modules/preview-jobs/preview-jobs.module";
import { AuthModule } from "@/modules/auth/auth.module";
import { DecksModule } from "@/modules/decks/decks.module";
import { HealthModule } from "@/modules/health/health.module";

/**
 * The HTTP API process. AuthModule registers login + the "jwt" Passport strategy
 * (so JwtAuthGuard works on the preview endpoints); PreviewJobsModule pulls in
 * the slides generation capability and the shared Redis infra it needs;
 * DecksModule exposes the read-only "my decks" API (006 US3); HealthModule
 * exposes the public liveness probe `GET /api/health` for the Docker
 * healthcheck (012).
 */
@Module({
  imports: [AuthModule, PreviewJobsModule, DecksModule, HealthModule]
})
export class AppModule {}
