import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "@/app/app.module";
import { buildOpenApiDocument } from "@/openapi/openapi-document";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

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
