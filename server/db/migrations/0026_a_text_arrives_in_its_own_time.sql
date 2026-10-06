-- How a Shot's text arrives: five columns on a Scene, and the same five on a Shot,
-- null there being *as the Scene says* — see issue #358 and
-- `docs/adr/0052-a-text-arrives-in-its-own-time.md`. Every one has a default or
-- is nullable, and the defaults are every Story already written.
--
-- `IF NOT EXISTS` because the `development` branch already holds these columns:
-- an earlier build of this change was migrated onto it as a `0024` of its own,
-- and every CI run forks that branch. Everywhere else the columns are new and
-- this adds them; there the clause changes nothing.

ALTER TABLE "scenes" ADD COLUMN IF NOT EXISTS "text_after" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN IF NOT EXISTS "text_by" text DEFAULT 'whole' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN IF NOT EXISTS "text_pace" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN IF NOT EXISTS "text_over" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN IF NOT EXISTS "text_stays" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN IF NOT EXISTS "text_after" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN IF NOT EXISTS "text_by" text;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN IF NOT EXISTS "text_pace" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN IF NOT EXISTS "text_over" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN IF NOT EXISTS "text_stays" integer;
