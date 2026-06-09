import { Module } from "@nestjs/common";
import { AuthModule } from "@/modules/auth/auth.module";
import { DbModule } from "@/infra/db/db.module";
import { DecksController } from "@/modules/decks/decks.controller";
import { DrizzleDeckStore } from "@/modules/decks/drizzle-deck-store";
import { DECK_STORE } from "@/modules/decks/decks.tokens";
import { ThemesModule } from "@/modules/themes/themes.module";

/**
 * The read-only "my decks" API (006 US3) + the 010 edit-revision write. Imports
 * AuthModule so JwtAuthGuard / the "jwt" strategy resolve, DbModule for the
 * Drizzle-backed store, and (011) ThemesModule so the edit path can load the theme
 * catalogue when an edit re-themes. Writes happen in the worker for generation
 * (WorkerModule provides its own DECK_STORE); this module is the read + edit path.
 */
@Module({
  imports: [AuthModule, DbModule, ThemesModule],
  controllers: [DecksController],
  providers: [{ provide: DECK_STORE, useClass: DrizzleDeckStore }]
})
export class DecksModule {}
