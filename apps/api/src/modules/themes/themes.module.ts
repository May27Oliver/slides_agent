import { Module } from "@nestjs/common";
import { DbModule } from "@/infra/db/db.module";
import { DrizzleThemeStore } from "@/modules/themes/drizzle-theme-store";
import { ThemesController } from "@/modules/themes/themes.controller";
import { THEME_STORE } from "@/modules/themes/themes.tokens";

/**
 * Builtin theme catalogue (feature 007 + 011). Provides the Drizzle-backed
 * ThemeStore so the design stage can run the mandatory selectTheme step, and (011)
 * exposes `GET /api/themes` for browsing. Imported by both SlidesModule (API) and
 * WorkerModule (generation runs in the worker); the worker uses
 * createApplicationContext, which ignores the controller.
 */
@Module({
  imports: [DbModule],
  controllers: [ThemesController],
  providers: [{ provide: THEME_STORE, useClass: DrizzleThemeStore }],
  exports: [THEME_STORE]
})
export class ThemesModule {}
