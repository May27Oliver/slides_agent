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
import { AuthController } from "@/modules/auth/auth.controller";
import { LocalStrategy } from "@/modules/auth/local.strategy";
import { JwtStrategy } from "@/modules/auth/jwt.strategy";
import { DbUserAccountStore } from "@/modules/auth/db-user-account-store";
import { USER_ACCOUNT_STORE } from "@/modules/auth/auth.tokens";
import { DbService } from "@/infra/db/db.service";

// AuthModule (imported by AppModule) reads AUTH_JWT_SECRET at build time (fail-fast).
process.env.AUTH_JWT_SECRET ||= "test-secret-0123456789-0123456789ab";
// DbModule (imported by AuthModule) reads DATABASE_URL at construction (fail-fast);
// the Pool connects lazily so a fake URL is enough — DbService is also overridden.
process.env.DATABASE_URL ||= "postgresql://fake:5432/slides_agent";

// Verify module ownership boundaries without opening real Redis connections:
// the Redis-touching providers are replaced with inert fakes so DI resolution
// (which providers each process's module graph exposes) is what's under test.
const fakeRedisService = {
  redisUrl: "redis://fake:6379",
  client: {},
  onModuleDestroy: async () => undefined
};
const fakeQueueService = { queue: {}, onModuleDestroy: async () => undefined };
const fakeDbService = { pool: {}, db: {}, onModuleDestroy: async () => undefined };

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
      .overrideProvider(DbService)
      .useValue(fakeDbService)
      .compile();

    expect(moduleRef.get(PreviewJobsController, { strict: false })).toBeInstanceOf(
      PreviewJobsController
    );
    expect(moduleRef.get(PreviewJobTimeoutSweeper, { strict: false })).toBeInstanceOf(
      PreviewJobTimeoutSweeper
    );
    expect(moduleRef.get(SlidesService, { strict: false })).toBeInstanceOf(SlidesService);
    expect(() => moduleRef!.get(PreviewWorkerRuntime, { strict: false })).toThrow();
    // Auth wiring resolves under tsx (no decorator metadata) — Passport
    // strategies + controller use explicit @Inject.
    expect(moduleRef.get(AuthController, { strict: false })).toBeInstanceOf(AuthController);
    expect(moduleRef.get(LocalStrategy, { strict: false })).toBeInstanceOf(LocalStrategy);
    expect(moduleRef.get(JwtStrategy, { strict: false })).toBeInstanceOf(JwtStrategy);
    // 006: accounts now come from the DB store (behind the unchanged port).
    expect(moduleRef.get(USER_ACCOUNT_STORE, { strict: false })).toBeInstanceOf(DbUserAccountStore);
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
