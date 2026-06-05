import { Module } from "@nestjs/common";
import { AuthModule } from "@/modules/auth/auth.module";
import { DbModule } from "@/infra/db/db.module";
import { DecksController } from "@/modules/decks/decks.controller";
import { DrizzleDeckStore } from "@/modules/decks/drizzle-deck-store";
import { DECK_STORE } from "@/modules/decks/decks.tokens";

/**
 * The read-only "my decks" API (006 US3). Imports AuthModule so JwtAuthGuard /
 * the "jwt" strategy resolve, and DbModule for the Drizzle-backed store. Writes
 * happen in the worker (WorkerModule provides its own DECK_STORE); this module is
 * the read path on the API process.
 */
@Module({
  imports: [AuthModule, DbModule],
  controllers: [DecksController],
  providers: [{ provide: DECK_STORE, useClass: DrizzleDeckStore }]
})
export class DecksModule {}
