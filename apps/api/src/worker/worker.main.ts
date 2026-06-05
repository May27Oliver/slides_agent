import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "@/app/worker.module";

// Declare this process as the worker before any provider is constructed, so
// DbService (via loadDbConfig) picks the smaller worker pool default. The worker
// only hits the DB to auto-save a deck after a successful generation.
process.env.DB_POOL_ROLE ??= "worker";

/**
 * Standalone, non-HTTP worker process. It bootstraps WorkerModule (shared
 * Redis + slides feature + the BullMQ consumer). PreviewWorkerRuntime starts the
 * consumer via OnApplicationBootstrap and cleans up via OnModuleDestroy; both
 * are driven by Nest's lifecycle + shutdown hooks.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ["error", "warn", "log"]
  });
  app.enableShutdownHooks();
}

bootstrap().catch((error) => {
  new Logger("PreviewJobWorker").error("Failed to start preview job worker", error);
  process.exit(1);
});
