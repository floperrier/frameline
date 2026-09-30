ALTER TABLE "scenes" ADD COLUMN "text_after" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "text_by" text DEFAULT 'whole' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "text_pace" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "text_over" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "text_stays" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "text_after" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "text_by" text;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "text_pace" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "text_over" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "text_stays" integer;