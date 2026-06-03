import { Module } from "@nestjs/common";
import { RedisModule } from "@/infra/redis/redis.module";
import { SlidesModule } from "@/modules/slides/slides.module";
import { PreviewWorkerRuntime } from "@/modules/slides/preview-worker.runtime";

/**
 * The worker process: shared Redis infra + the slides feature (for SlidesService
 * and the job store) + the BullMQ consumer runtime. It has no HTTP controller
 * and never starts the timeout sweeper (the API process owns that).
 */
@Module({
  imports: [RedisModule, SlidesModule],
  providers: [PreviewWorkerRuntime]
})
export class WorkerAppModule {}
