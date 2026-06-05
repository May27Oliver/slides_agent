import "reflect-metadata";
import { repl } from "@nestjs/core";
import { DbConsoleModule } from "@/app/db-console.module";

/**
 * NestJS REPL entrypoint for ad-hoc DB inspection (`pnpm db:repl`). Uses the
 * framework's built-in `repl()` (https://docs.nestjs.com/recipes/repl) over a
 * DB-only module, so the full dependency graph is browsable from the terminal:
 *   help()                  list REPL commands
 *   debug()                 show modules / providers
 *   methods(DrizzleDeckStore)
 *   get(DbService).pool.query('select count(*) from decks').then(r => r.rows)
 */
async function bootstrap(): Promise<void> {
  await repl(DbConsoleModule);
}

bootstrap().catch((error) => {
  console.error("REPL failed to start:", error instanceof Error ? error.message : error);
  process.exit(1);
});
