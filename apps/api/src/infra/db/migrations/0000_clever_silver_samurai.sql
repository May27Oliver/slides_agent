CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "deck_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"slide_deck" jsonb NOT NULL,
	"design_plan" jsonb,
	"html" text,
	"generation_summary" jsonb,
	"origin" text NOT NULL,
	"source_job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"source_content" text NOT NULL,
	"deck_brief" jsonb NOT NULL,
	"current_revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"account_id" text,
	"name" text NOT NULL,
	"description" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applies_to" text NOT NULL,
	"support" text NOT NULL,
	"style_kit" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_revisions" ADD CONSTRAINT "deck_revisions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deck_revisions_deck_rev_idx" ON "deck_revisions" USING btree ("deck_id","revision");--> statement-breakpoint
CREATE INDEX "decks_account_updated_idx" ON "decks" USING btree ("account_id","updated_at");--> statement-breakpoint
CREATE INDEX "themes_scope_idx" ON "themes" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "themes_account_idx" ON "themes" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "themes_select_idx" ON "themes" USING btree ("applies_to","support");