import { Module } from "@nestjs/common";
import { PreviewJobsModule } from "@/modules/preview-jobs/preview-jobs.module";
import { AuthModule } from "@/modules/auth/auth.module";
import { AdminModule } from "@/modules/admin/admin.module";
import { DecksModule } from "@/modules/decks/decks.module";

/**
 * The HTTP API process. AuthModule registers login + registration + the "jwt"
 * Passport strategy (so JwtAuthGuard works on the preview endpoints); AdminModule
 * exposes the admin user-management dashboard API (013 US2); PreviewJobsModule
 * pulls in the slides generation capability and the shared Redis infra it needs;
 * DecksModule exposes the read-only "my decks" API (006 US3).
 */
@Module({
  imports: [AuthModule, AdminModule, PreviewJobsModule, DecksModule]
})
export class AppModule {}
