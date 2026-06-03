import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import IORedis from "ioredis";
import { Worker } from "bullmq";
import { SlidesModule } from "@/modules/slides/slides.module";
import { SlidesService } from "@/modules/slides/slides.service";
import { loadQueueConfig } from "@/modules/slides/queue.config";
import { runPreviewJobGeneration } from "@/modules/slides/preview-job-execution";
import type { RedisPreviewJobStore } from "@/modules/slides/redis-preview-job-store";
import type { PreviewJobQueuePayload } from "@/modules/slides/bullmq-preview-job-runner";
import { PREVIEW_JOB_STORE } from "@/modules/slides/slides.tokens";

/**
 * Standalone, non-HTTP worker entrypoint. It reuses the SlidesModule DI graph
 * (so it gets the same SlidesService + LLM adapters as the API) via an
 * application context, then consumes the BullMQ queue and runs each job through
 * the shared generation pipeline. It deliberately does NOT start the timeout
 * sweeper — that runs in the API process.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger("PreviewJobWorker");
  const config = loadQueueConfig();

  const app = await NestFactory.createApplicationContext(SlidesModule, {
    logger: ["error", "warn", "log"]
  });
  const slidesService = app.get(SlidesService);
  const store = app.get<RedisPreviewJobStore>(PREVIEW_JOB_STORE);

  // BullMQ worker connections must use maxRetriesPerRequest: null.
  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker<PreviewJobQueuePayload>(
    config.queueName,
    async (bullJob) => {
      const { jobId } = bullJob.data;
      const job = await store.findById(jobId);
      if (!job) {
        logger.warn(`${jobId} not found in store; skipping`);
        return;
      }
      await runPreviewJobGeneration({ store, slidesService, job, logger });
    },
    { connection, concurrency: config.workerConcurrency }
  );

  worker.on("failed", (bullJob, error) => {
    // The job's user-facing failure is already sanitized in the store; this is
    // an internal operational log only.
    logger.error(`bull job ${bullJob?.id ?? "unknown"} failed: ${error.name}`);
  });

  logger.log(
    `Preview job worker started queue=${config.queueName} concurrency=${config.workerConcurrency}`
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Received ${signal}; shutting down worker`);
    await worker.close();
    await connection.quit();
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  new Logger("PreviewJobWorker").error("Failed to start preview job worker", error);
  process.exit(1);
});
