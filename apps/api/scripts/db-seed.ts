import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadSeedAccounts } from "@/config/auth.config";
import { loadDbConfig } from "@/config/db.config";
import type { AppDatabase } from "@/infra/db/db.service";
import { seedAccounts } from "@/infra/db/seed-accounts";
import { seedThemes, ThemeSeedValidationError, type ThemeSeed } from "@/infra/db/seed-themes";
import * as schema from "@/infra/db/schema";

/**
 * Seeds the DB: the account allowlist (from AUTH_ACCOUNTS) and the builtin theme
 * catalogue (007 — from the committed seeds/*.json). Both are idempotent upserts,
 * so re-running is safe. Theme seeding is all-or-nothing: any invalid row aborts
 * the whole theme batch (the accounts already committed independently). Env loaded
 * by the npm script (`--env-file=../../.env`). See research.md DR-003.
 */

const SEEDS_DIR = fileURLToPath(new URL("../src/infra/db/seeds/", import.meta.url));

function loadThemeSeeds(): ThemeSeed[] {
  return ["theme-fonts.json", "theme-palettes.json", "theme-styles.json"].flatMap(
    (file) => JSON.parse(readFileSync(`${SEEDS_DIR}${file}`, "utf8")) as ThemeSeed[]
  );
}

async function main(): Promise<void> {
  const { databaseUrl } = loadDbConfig();
  const source = loadSeedAccounts();
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema }) as AppDatabase;

  try {
    const accountCount = await seedAccounts(db, source);
    process.stdout.write(`Seeded ${accountCount} account(s).\n`);

    const themeSeeds = loadThemeSeeds();
    const result = await seedThemes(db, themeSeeds);
    process.stdout.write(
      `Seeded ${result.total} theme(s): font=${result.byKind.font}, palette=${result.byKind.palette}, style=${result.byKind.style}.\n`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  if (error instanceof ThemeSeedValidationError) {
    process.stderr.write(`db:seed failed — invalid theme seeds:\n${error.message}\n`);
  } else {
    process.stderr.write(`db:seed failed: ${String(error)}\n`);
  }
  process.exit(1);
});
