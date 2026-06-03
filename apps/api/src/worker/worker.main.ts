import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerAppModule } from "@/app/worker-app.module";
import { PreviewWorkerRuntime } from "@/modules/slides/preview-worker.runtime";

/**
 * Standalone, non-HTTP worker process. It bootstraps WorkerAppModule (shared
 * Redis + slides feature + the BullMQ consumer) and starts the consumer. All
 * lifecycle/cleanup lives in the providers' onModuleDestroy hooks, triggered by
 * Nest shutdown hooks.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    logger: ["error", "warn", "log"]
  });
  app.enableShutdownHooks();
  app.get(PreviewWorkerRuntime).start();
}

bootstrap().catch((error) => {
  new Logger("PreviewJobWorker").error("Failed to start preview job worker", error);
  process.exit(1);
});
