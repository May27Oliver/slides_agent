import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SlidesModule } from "@/modules/slides/slides.module";
import { PreviewJobTimeoutSweeper } from "@/modules/slides/preview-job-timeout-sweeper";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(SlidesModule);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  // The API process owns the out-of-worker 5-minute timeout sweep (the worker
  // process does not start it).
  app.get(PreviewJobTimeoutSweeper).start();
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? "127.0.0.1");
}

bootstrap().catch((error) => {
  new Logger("Bootstrap").error("Failed to start API", error);
  process.exit(1);
});
