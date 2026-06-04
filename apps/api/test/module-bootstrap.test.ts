import { afterEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { AppModule } from "@/app/app.module";
import { WorkerModule } from "@/app/worker.module";
import { RedisService } from "@/infra/redis/redis.service";
import { PreviewJobQueueService } from "@/modules/preview-jobs/preview-job-queue.service";
import { PreviewJobsController } from "@/modules/preview-jobs/preview-jobs.controller";
import { PreviewJobTimeoutSweeper } from "@/modules/preview-jobs/preview-job-timeout-sweeper";
import { PreviewWorkerRuntime } from "@/modules/preview-jobs/preview-worker.runtime";
import { SlidesService } from "@/modules/slides/slides.service";

// Verify module ownership boundaries without opening real Redis connections:
// the Redis-touching providers are replaced with inert fakes so DI resolution
// (which providers each process's module graph exposes) is what's under test.
const fakeRedisService = {
  redisUrl: "redis://fake:6379",
  client: {},
  onModuleDestroy: async () => undefined
};
const fakeQueueService = { queue: {}, onModuleDestroy: async () => undefined };

describe("module bootstrap boundaries", () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
  });

  it("AppModule (API) wires the controller + sweeper but not the worker runtime", async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService)
      .useValue(fakeRedisService)
      .overrideProvider(PreviewJobQueueService)
      .useValue(fakeQueueService)
      .compile();

    expect(moduleRef.get(PreviewJobsController, { strict: false })).toBeInstanceOf(
      PreviewJobsController
    );
    expect(moduleRef.get(PreviewJobTimeoutSweeper, { strict: false })).toBeInstanceOf(
      PreviewJobTimeoutSweeper
    );
    expect(moduleRef.get(SlidesService, { strict: false })).toBeInstanceOf(SlidesService);
    expect(() => moduleRef!.get(PreviewWorkerRuntime, { strict: false })).toThrow();
  });

  it("WorkerModule wires the worker runtime but not the controller or sweeper", async () => {
    moduleRef = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(RedisService)
      .useValue(fakeRedisService)
      .compile();

    expect(moduleRef.get(PreviewWorkerRuntime, { strict: false })).toBeInstanceOf(
      PreviewWorkerRuntime
    );
    expect(moduleRef.get(SlidesService, { strict: false })).toBeInstanceOf(SlidesService);
    expect(() => moduleRef!.get(PreviewJobsController, { strict: false })).toThrow();
    expect(() => moduleRef!.get(PreviewJobTimeoutSweeper, { strict: false })).toThrow();
  });
});
