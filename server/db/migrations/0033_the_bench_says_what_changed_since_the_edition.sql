-- A Shot keeps the hex of its Image's SHA-256 and of its Sound's, and a Scene of
-- its Sound's, beside the bytes, so a Publish and the bench's read of a published
-- Story name each medium by its digest without hashing a byte — see issue #422
-- and `docs/adr/0070-the-bench-says-what-changed-since-the-edition.md`.
--
-- A trigger keeps each one equal to its bytes, and not a generated column. A
-- deleted Shot put `back`, a Story's `copy` and a Shot's `duplicate` are inserted
-- through `jsonb_populate_record`, which carries every column of the row, and
-- Postgres refuses any value but `DEFAULT` in a generated one; a trigger writes
-- over whatever such an insert carries. `update of` fires only when a statement
-- names the bytes, so a Shot's words saved never hash its Image.
--
-- The functions, the triggers and the three `UPDATE`s are hand-written in a
-- generated directory, as `0025`'s are: drizzle-kit writes the columns and knows
-- nothing of the rest. The triggers are in place before the rows are digested,
-- so a medium written while this runs is digested by one or the other. The code
-- before this one never names the columns, and the triggers keep them for its
-- writes as well, so the deploy has no window to fall into —
-- `docs/adr/0002-the-schema-moves-with-the-deploy.md`.

ALTER TABLE "scenes" ADD COLUMN "sound_digest" text;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "image_digest" text;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "sound_digest" text;--> statement-breakpoint
CREATE FUNCTION "image_digest"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.image_digest := encode(sha256(NEW.image), 'hex');
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE FUNCTION "sound_digest"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.sound_digest := encode(sha256(NEW.sound), 'hex');
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "shots_image_digest" BEFORE INSERT OR UPDATE OF "image" ON "shots"
  FOR EACH ROW EXECUTE FUNCTION "image_digest"();--> statement-breakpoint
CREATE TRIGGER "shots_sound_digest" BEFORE INSERT OR UPDATE OF "sound" ON "shots"
  FOR EACH ROW EXECUTE FUNCTION "sound_digest"();--> statement-breakpoint
CREATE TRIGGER "scenes_sound_digest" BEFORE INSERT OR UPDATE OF "sound" ON "scenes"
  FOR EACH ROW EXECUTE FUNCTION "sound_digest"();--> statement-breakpoint
UPDATE "shots" SET "image_digest" = encode(sha256("image"), 'hex') WHERE "image" IS NOT NULL;--> statement-breakpoint
UPDATE "shots" SET "sound_digest" = encode(sha256("sound"), 'hex') WHERE "sound" IS NOT NULL;--> statement-breakpoint
UPDATE "scenes" SET "sound_digest" = encode(sha256("sound"), 'hex') WHERE "sound" IS NOT NULL;
