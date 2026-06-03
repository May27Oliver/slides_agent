import { Module } from "@nestjs/common";
import { RedisService } from "@/infra/redis/redis.service";
import { REDIS_CONNECTION } from "@/infra/redis/redis.tokens";

/**
 * Shared Redis infrastructure. Any feature module that needs Redis imports this
 * module and injects {@link REDIS_CONNECTION} (or {@link RedisService}); no
 * feature owns the connection. Not `@Global()` on purpose — explicit
 * `imports: [RedisModule]` keeps dependencies visible until many modules need it.
 */
@Module({
  providers: [
    RedisService,
    {
      provide: REDIS_CONNECTION,
      useFactory: (service: RedisService) => service.client,
      inject: [RedisService]
    }
  ],
  exports: [RedisService, REDIS_CONNECTION]
})
export class RedisModule {}
