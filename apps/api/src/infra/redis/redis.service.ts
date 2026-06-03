import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import IORedis from "ioredis";
import { loadRedisConfig } from "@/infra/redis/redis.config";

/**
 * Owns the process-wide shared Redis connection used for regular commands
 * (preview-job store, timeout sweeper, and any future feature such as auth).
 * Features inject the connection via {@link REDIS_CONNECTION}; they do not own
 * it. `redisUrl` is exposed so callers that need a differently-configured
 * connection (e.g. a BullMQ worker requiring `maxRetriesPerRequest: null`) can
 * derive one without re-reading the environment.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly redisUrl: string;
  readonly client: IORedis;

  constructor() {
    const { redisUrl } = loadRedisConfig();
    this.redisUrl = redisUrl;
    // enableOfflineQueue:false => commands reject promptly when Redis is down
    // (fail-fast) instead of queueing forever.
    this.client = new IORedis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
