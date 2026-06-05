import { Module } from "@nestjs/common";
import { DbModule } from "@/infra/db/db.module";
import { DrizzleThemeStore } from "@/modules/themes/drizzle-theme-store";
import { THEME_STORE } from "@/modules/themes/themes.tokens";

/**
 * Builtin theme catalogue (feature 007). Provides the Drizzle-backed ThemeStore
 * so the design stage can run the mandatory selectTheme step. Imported by both
 * SlidesModule (API) and WorkerModule (generation runs in the worker).
 */
@Module({
  imports: [DbModule],
  providers: [{ provide: THEME_STORE, useClass: DrizzleThemeStore }],
  exports: [THEME_STORE]
})
export class ThemesModule {}
