import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import IORedis from "ioredis";
import { Queue } from "bullmq";
import { RedisService } from "@/infra/redis/redis.service";
import type { PptxQueueConfig } from "@/modules/pptx-export-jobs/queue.config";
import { PPTX_QUEUE_CONFIG } from "@/modules/pptx-export-jobs/pptx-export-jobs.tokens";

/**
 * Owns the PPTX export BullMQ producer (Queue + its dedicated connection), with
 * shutdown cleanup — mirrors PreviewJobQueueService.
 */
@Injectable()
export class PptxExportJobQueueService implements OnModuleDestroy {
  readonly queue: Queue;
  private readonly connection: IORedis;

  constructor(
    @Inject(PPTX_QUEUE_CONFIG) config: PptxQueueConfig,
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
