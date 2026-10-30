-- The bytes of a Shot's Image leave its row for a private bucket, an object
-- apiece named by their SHA-256, and a `media` row records each object — see
-- `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md`. The server now
-- writes `image_digest` as the bytes come in, so the trigger migration 0033 kept
-- it with goes, with its function; the Sounds' triggers stay until their bytes
-- follow.
--
-- The rows this finds are test data, so nothing is moved into the bucket. Every
-- digest an Image column or an edition holds would name an object the bucket does
-- not have, so each is dropped: the Images' digests, every row of
-- `edition_media`, and with them every Edition, each Story left as Unpublish
-- leaves one. A Story keeps its words. A Sound's bytes are still in their rows,
-- and the Sounds an Edition played go with it as an Image's do, to be copied
-- again by the next Publish.
--
-- The trigger, the four data statements and their order are hand-written in a
-- generated directory, as 0025's and 0033's are: the digests are emptied before
-- the foreign key is added, which would refuse them.

CREATE TABLE "media" (
	"digest" text PRIMARY KEY NOT NULL,
	"size" integer NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TRIGGER "shots_image_digest" ON "shots";--> statement-breakpoint
DROP FUNCTION "image_digest"();--> statement-breakpoint
UPDATE "shots" SET "image_digest" = NULL WHERE "image_digest" IS NOT NULL;--> statement-breakpoint
UPDATE "deleted_shots" SET "row" = jsonb_set("row" - 'image', '{image_digest}', 'null'::jsonb);--> statement-breakpoint
DELETE FROM "edition_media";--> statement-breakpoint
UPDATE "stories" SET "published_at" = NULL, "listed" = false, "edition" = NULL, "edition_at" = NULL
  WHERE "published_at" IS NOT NULL OR "edition" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_media" ALTER COLUMN "bytes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shots" ADD CONSTRAINT "shots_image_digest_media_digest_fk" FOREIGN KEY ("image_digest") REFERENCES "public"."media"("digest") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shots" DROP COLUMN "image";
