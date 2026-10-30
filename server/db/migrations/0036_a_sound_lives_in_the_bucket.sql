-- The bytes of a Sound follow an Image's out of their row, into the private
-- bucket, an object apiece named by their SHA-256 and recorded in `media` — see
-- `docs/adr/0092-images-and-sounds-live-in-a-private-bucket.md`. The server now
-- writes `sound_digest` on a Shot and on a Scene as the bytes come in, so the
-- triggers migration 0033 kept them with go, with their function, and with them
-- the last column of bytes: an edition holds digests alone, so `edition_media`
-- keeps its pair of Story and digest and lets go of `bytes`.
--
-- The rows this finds are test data, so nothing is moved into the bucket. Every
-- Sound digest would name an object the bucket does not have, so each is
-- dropped, on a Shot, on a Scene and in a deleted Shot held for a day; every row
-- of `edition_media` goes, since a Sound's row there holds its bytes and no
-- object, and with them every Edition, each Story left as Unpublish leaves one.
-- A Story keeps its words, and the next Publish takes its edition again.
--
-- The triggers, the five data statements and their order are hand-written in a
-- generated directory, as 0025's, 0033's and 0035's are: the digests are
-- emptied before the foreign keys are added, which would refuse them.

DROP TRIGGER "shots_sound_digest" ON "shots";--> statement-breakpoint
DROP TRIGGER "scenes_sound_digest" ON "scenes";--> statement-breakpoint
DROP FUNCTION "sound_digest"();--> statement-breakpoint
UPDATE "shots" SET "sound_digest" = NULL WHERE "sound_digest" IS NOT NULL;--> statement-breakpoint
UPDATE "scenes" SET "sound_digest" = NULL WHERE "sound_digest" IS NOT NULL;--> statement-breakpoint
UPDATE "deleted_shots" SET "row" = jsonb_set("row" - 'sound', '{sound_digest}', 'null'::jsonb);--> statement-breakpoint
DELETE FROM "edition_media";--> statement-breakpoint
UPDATE "stories" SET "published_at" = NULL, "listed" = false, "edition" = NULL, "edition_at" = NULL
  WHERE "published_at" IS NOT NULL OR "edition" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_media" DROP COLUMN "bytes";--> statement-breakpoint
ALTER TABLE "scenes" DROP COLUMN "sound";--> statement-breakpoint
ALTER TABLE "shots" DROP COLUMN "sound";--> statement-breakpoint
ALTER TABLE "edition_media" ADD CONSTRAINT "edition_media_digest_media_digest_fk" FOREIGN KEY ("digest") REFERENCES "public"."media"("digest") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_sound_digest_media_digest_fk" FOREIGN KEY ("sound_digest") REFERENCES "public"."media"("digest") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shots" ADD CONSTRAINT "shots_sound_digest_media_digest_fk" FOREIGN KEY ("sound_digest") REFERENCES "public"."media"("digest") ON DELETE no action ON UPDATE no action;
