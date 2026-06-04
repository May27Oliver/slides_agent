import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "@/app/app.module";
import { buildOpenApiDocument } from "@/openapi/openapi-document";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  // Note: request validation is done by the contracts validator inside the
  // controller (parseGeneratePreviewRequest), not a DTO/ValidationPipe — the
  // shared contract validator is the single runtime source of truth.

  // OpenAPI docs served at /api/docs (JSON at /api/docs-json). The document is a
  // static object built from the shared contract schemas — no controller
  // reflection, which tsx (no decorator metadata) cannot support.
  SwaggerModule.setup("api/docs", app, buildOpenApiDocument());

  // Drives provider lifecycle on SIGINT/SIGTERM: RedisService quits the shared
  // connection, PreviewJobQueueService closes the queue, PreviewJobsApiRuntime
  // stops the timeout sweep. The sweep is started on bootstrap by that runtime.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? "127.0.0.1");
}

bootstrap().catch((error) => {
  new Logger("Bootstrap").error("Failed to start API", error);
  process.exit(1);
});
