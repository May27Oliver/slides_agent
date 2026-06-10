ALTER TABLE "accounts" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- 013 backfill: map the legacy two-state `active` onto the new `status` before the
-- old column is dropped in the next migration, so no row loses its enabled state.
UPDATE "accounts" SET "status" = CASE WHEN "active" THEN 'active' ELSE 'disabled' END;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_status_check" CHECK ("accounts"."status" in ('pending', 'active', 'disabled'));