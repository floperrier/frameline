ALTER TABLE "stories" ADD COLUMN "first_listed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "stories_catalogue_idx" ON "stories" USING btree ("listed","first_listed_at" DESC NULLS LAST,"id");--> statement-breakpoint
-- Every Story Listed when the column arrives takes the day it was first
-- published as the day it first entered the Catalogue. The two differ only for
-- a Story listed some time after its Publish, and the Stories in production then
-- are test data, so the approximation costs nothing — see issue #503. Written by
-- hand under drizzle-kit's statements, as `0007`'s backfill is; a second run
-- finds every Listed Story dated and rewrites nothing.
UPDATE "stories" SET "first_listed_at" = "published_at" WHERE "listed" AND "first_listed_at" IS NULL;
