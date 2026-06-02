import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SlidesModule } from "@/modules/slides/slides.module";

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
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? "127.0.0.1");
}

bootstrap().catch((error) => {
  new Logger("Bootstrap").error("Failed to start API", error);
  process.exit(1);
});
