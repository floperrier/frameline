ALTER TABLE "cuts" ADD COLUMN "conditions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "cuts" SET "conditions" = jsonb_build_array("condition") WHERE "condition" IS NOT NULL;
