ALTER TABLE "shots" ADD COLUMN "formatted" jsonb;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "text_face" text DEFAULT 'prose' NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "text_align" text DEFAULT 'start' NOT NULL;