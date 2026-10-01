ALTER TABLE "scenes" ADD COLUMN "movement_by" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "movement_direction" text DEFAULT 'closer' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "movement_over" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "movement_by" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "movement_direction" text;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "movement_over" integer;