DROP INDEX "themes_select_idx";--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "kind" text NOT NULL;--> statement-breakpoint
CREATE INDEX "themes_select_idx" ON "themes" USING btree ("kind","applies_to","support");