import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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

// 013: account lifecycle is the three-state `status` (pending|active|disabled),
// replacing the old two-state `active` boolean (No shim). `is_admin` gates the
// admin dashboard. See specs/013-user-registration/plan.md (DR-001/DR-003).
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    status: text("status").notNull().default("pending"),
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    statusCheck: check(
      "accounts_status_check",
      sql`${table.status} in ('pending', 'active', 'disabled')`
    ),
    // Serves the FR-018 active-admin count + FOR UPDATE lock (is_admin AND
    // status='active') on every admin mutation, so it never scans the full table.
    activeAdminIdx: index("accounts_active_admin_idx").on(table.isAdmin, table.status)
  })
);

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
    // 010 (C1/FR-006a): the planned chart intents (source facts) the renderer needs
    // to redraw real charts on edit. Additive + nullable — revisions written before
    // 010 are null and degrade to the renderer's deterministic chart fallback.
    chartIntents: jsonb("chart_intents"),
    origin: text("origin").notNull(),
    sourceJobId: text("source_job_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    deckRevision: uniqueIndex("deck_revisions_deck_rev_idx").on(table.deckId, table.revision)
  })
);

// Builtin theme catalogue (feature 007). 006 reserved this table empty; 007 adds
// the `kind` column (font | palette | style) so the three selection axes live in
// one table, and rebuilds the selection index to lead with `kind`. See
// specs/007-design-theme-system/data-model.md (DR-001 / DR-007).
export const themes = pgTable(
  "themes",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(),
    // 007: distinguishes the three selection axes (font / palette / style).
    kind: text("kind").notNull(),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    keywords: jsonb("keywords")
      .notNull()
      .default(sql`'[]'::jsonb`),
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
    // kind leads: it is the strongest filter for selectTheme's per-kind queries.
    selectIdx: index("themes_select_idx").on(table.kind, table.appliesTo, table.support)
  })
);
