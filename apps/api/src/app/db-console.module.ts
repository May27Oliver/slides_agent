import { Module } from "@nestjs/common";
import { DbModule } from "@/infra/db/db.module";
import { DbUserAccountStore } from "@/modules/auth/db-user-account-store";
import { DrizzleDeckStore } from "@/modules/decks/drizzle-deck-store";
import { DECK_STORE } from "@/modules/decks/decks.tokens";

/**
 * A DB-only module for the NestJS REPL (`pnpm db:repl`). It imports just DbModule
 * plus the two DB-backed stores — NOT AppModule — so the console boots with only
 * DATABASE_URL configured (no Redis, no auth secret, no background workers).
 *
 * In the REPL you can then:
 *   get(DbService).pool.query('select id, title from decks')   // raw SQL
 *   await get(DrizzleDeckStore).listByAccount('oliver.chen')   // typed store
 *   await get(DbUserAccountStore).findByUsername('me@x.com')
 */
@Module({
  imports: [DbModule],
  providers: [
    DrizzleDeckStore,
    DbUserAccountStore,
    { provide: DECK_STORE, useClass: DrizzleDeckStore }
  ],
  exports: [DrizzleDeckStore, DbUserAccountStore]
})
export class DbConsoleModule {}
