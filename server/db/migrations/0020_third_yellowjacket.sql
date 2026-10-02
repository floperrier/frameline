ALTER TABLE "exits" ADD COLUMN "steps_back" boolean;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "steps_back" boolean DEFAULT true NOT NULL;