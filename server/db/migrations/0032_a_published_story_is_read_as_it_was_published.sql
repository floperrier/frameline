CREATE TABLE "edition_media" (
	"story_id" uuid NOT NULL,
	"digest" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	CONSTRAINT "edition_media_story_id_digest_pk" PRIMARY KEY("story_id","digest")
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "edition" jsonb;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "edition_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "edition_media" ADD CONSTRAINT "edition_media_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;