ALTER TABLE "cuts" ADD COLUMN "condition" jsonb;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "sets" jsonb DEFAULT '{}'::jsonb NOT NULL;