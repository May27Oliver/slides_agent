import { Module } from "@nestjs/common";
import { PreviewJobsModule } from "@/modules/preview-jobs/preview-jobs.module";

/**
 * The HTTP API process. PreviewJobsModule pulls in the slides generation
 * capability and the shared Redis infra it needs. Future features (e.g.
 * AuthModule) are added here and import RedisModule directly.
 */
@Module({
  imports: [PreviewJobsModule]
})
export class AppModule {}
