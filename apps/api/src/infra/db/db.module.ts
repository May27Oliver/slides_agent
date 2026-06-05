import { Module } from "@nestjs/common";
import { DbService } from "@/infra/db/db.service";
import { DRIZZLE } from "@/infra/db/db.tokens";

/**
 * Shared database infrastructure. Any feature module that needs the DB imports
 * this module and injects {@link DRIZZLE} (or {@link DbService}); no feature owns
 * the pool. Not `@Global()` on purpose — explicit `imports: [DbModule]` keeps
 * dependencies visible (mirrors RedisModule; see research.md DR-011).
 */
@Module({
  providers: [
    DbService,
    {
      provide: DRIZZLE,
      useFactory: (service: DbService) => service.db,
      inject: [DbService]
    }
  ],
  exports: [DbService, DRIZZLE]
})
export class DbModule {}
