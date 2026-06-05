import { Module } from "@nestjs/common";
import { PreviewJobsModule } from "@/modules/preview-jobs/preview-jobs.module";
import { AuthModule } from "@/modules/auth/auth.module";

/**
 * The HTTP API process. AuthModule registers login + the "jwt" Passport strategy
 * (so JwtAuthGuard works on the preview endpoints); PreviewJobsModule pulls in
 * the slides generation capability and the shared Redis infra it needs.
 */
@Module({
  imports: [AuthModule, PreviewJobsModule]
})
export class AppModule {}
