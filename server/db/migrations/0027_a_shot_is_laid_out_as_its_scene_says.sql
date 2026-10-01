ALTER TABLE "scenes" ADD COLUMN "layout" text DEFAULT 'inset' NOT NULL;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "layout" text;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "crop_x" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "crop_y" integer DEFAULT 50 NOT NULL;