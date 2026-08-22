ALTER TABLE "cuts" ADD COLUMN "position" integer;--> statement-breakpoint
UPDATE "cuts" SET "position" = numbered.place
FROM (
  SELECT "id", row_number() OVER (
    PARTITION BY "from_scene_id" ORDER BY "created_at", "id") - 1 AS place
  FROM "cuts"
) AS numbered
WHERE "cuts"."id" = numbered."id";--> statement-breakpoint
ALTER TABLE "cuts" ALTER COLUMN "position" SET NOT NULL;
