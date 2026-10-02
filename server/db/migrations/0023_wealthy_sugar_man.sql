ALTER TABLE "exits" ADD COLUMN "cut_over" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "exits" ADD COLUMN "cut_through" text DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "cut_after" integer;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "cut_over" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "cut_through" text DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "exits_after" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "cut_after" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "cut_over" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "cut_through" text;