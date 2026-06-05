import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "@/app/app.module";
import { buildOpenApiDocument } from "@/openapi/openapi-document";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix("api");

  // Secure default response headers (HSTS, X-Content-Type-Options, etc.).
  app.use(helmet());
  // CORS: open in development for convenience; in production restrict to the
  // known frontend origin (bearer tokens, not cookies, but this still blocks
  // drive-by cross-origin reads).
  if (process.env.NODE_ENV === "production") {
    app.enableCors({
      origin: process.env.ALLOWED_ORIGIN ?? "http://localhost:5173",
      methods: ["GET", "POST"]
    });
  } else {
    app.enableCors();
  }
  // Behind a reverse proxy, trust X-Forwarded-For so req.ip (and thus the login
  // rate limiter's per-client key) reflects the real client, not the proxy.
  if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
  }
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
