import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { SlidesModule } from "@/modules/slides/slides.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(SlidesModule);
  app.setGlobalPrefix("api");
  await app.listen(3000);
}

void bootstrap();
