import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

/**
 * Drizzle schema (feature 006). Declarative DB state only; the deterministic
 * renderer/engine stays in code. `username` is plain text + app-level lowercase
 * normalization (no citext) — see specs/006-db-persistence/research.md DR-004.
 */

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const decks = pgTable(
  "decks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").notNull(),
    sourceContent: text("source_content").notNull(),
    deckBrief: jsonb("deck_brief").notNull(),
    // Soft reference to the latest revision (no hard FK to avoid a cycle).
    currentRevisionId: uuid("current_revision_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountUpdated: index("decks_account_updated_idx").on(table.accountId, table.updatedAt)
  })
);

export const deckRevisions = pgTable(
  "deck_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    slideDeck: jsonb("slide_deck").notNull(),
    designPlan: jsonb("design_plan"),
    html: text("html"),
    generationSummary: jsonb("generation_summary"),
    origin: text("origin").notNull(),
    sourceJobId: text("source_job_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    deckRevision: uniqueIndex("deck_revisions_deck_rev_idx").on(table.deckId, table.revision)
  })
);

// Structure reserved for feature 007 (ui-ux-pro-max theme seeds). 006 creates the
// table but writes no rows. See THEME_SEED_INVENTORY.md.
export const themes = pgTable(
  "themes",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    keywords: jsonb("keywords").notNull().default(sql`'[]'::jsonb`),
    appliesTo: text("applies_to").notNull(),
    support: text("support").notNull(),
    styleKit: jsonb("style_kit").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    scopeIdx: index("themes_scope_idx").on(table.scope),
    accountIdx: index("themes_account_idx").on(table.accountId),
    selectIdx: index("themes_select_idx").on(table.appliesTo, table.support)
  })
);
