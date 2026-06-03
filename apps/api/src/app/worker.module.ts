import { Module } from "@nestjs/common";
import { RedisModule } from "@/infra/redis/redis.module";
import { SlidesModule } from "@/modules/slides/slides.module";
import { PreviewWorkerRuntime } from "@/modules/preview-jobs/preview-worker.runtime";
import {
  previewJobStoreProvider,
  queueConfigProvider
} from "@/modules/preview-jobs/preview-jobs.providers";

/**
 * The worker process: shared Redis infra + the slides generation capability +
 * the BullMQ consumer runtime and the job store/config it needs. It declares
 * only the shared preview-job providers (not the API-only producer queue,
 * controller, or timeout sweeper), and never starts the sweeper.
 */
@Module({
  imports: [RedisModule, SlidesModule],
  providers: [queueConfigProvider, previewJobStoreProvider, PreviewWorkerRuntime]
})
export class WorkerModule {}
