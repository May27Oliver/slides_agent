import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config (feature 006). `generate` reads only schema/out (offline);
 * dbCredentials.url is used by studio/push. Migrations are applied via an
 * explicit `pnpm db:migrate` (programmatic migrator) — never on API/worker boot.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infra/db/schema.ts",
  out: "./src/infra/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ""
  }
});
