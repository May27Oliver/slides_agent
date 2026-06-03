import { Module } from "@nestjs/common";
import { RedisModule } from "@/infra/redis/redis.module";
import { SlidesModule } from "@/modules/slides/slides.module";

/**
 * The HTTP API process: shared Redis infra + the slides feature (controller,
 * queue producer, timeout sweeper). Future features (e.g. AuthModule) are added
 * here and reuse RedisModule rather than pulling Redis from SlidesModule.
 */
@Module({
  imports: [RedisModule, SlidesModule]
})
export class AppModule {}
