import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import { RedisService } from "@/infra/redis/redis.service";
import type { QueueConfig } from "@/modules/preview-jobs/queue.config";
import { QUEUE_CONFIG } from "@/modules/preview-jobs/preview-jobs.tokens";

/**
 * Owns the BullMQ producer: the Queue and its dedicated Redis connection. The
 * producer connection is separate from the shared command connection because
 * BullMQ requires `maxRetriesPerRequest: null`. Implements OnModuleDestroy so
 * the queue and its connection are closed on shutdown (the shared connection is
 * owned by RedisService; the worker connection by PreviewWorkerRuntime).
 */
@Injectable()
export class PreviewJobQueueService implements OnModuleDestroy {
  readonly queue: Queue;
  private readonly connection: IORedis;

  constructor(
    @Inject(QUEUE_CONFIG) config: QueueConfig,
    @Inject(RedisService) redisService: RedisService
  ) {
    this.connection = new IORedis(redisService.redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(config.queueName, { connection: this.connection });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit().catch(() => undefined);
  }
}
